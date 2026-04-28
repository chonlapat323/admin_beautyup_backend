import { BadRequestException, Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { createHash, randomBytes } from "crypto";
import { FlowAccountService } from "../flowaccount/flowaccount.service";
import { OmiseService } from "../omise/omise.service";
import { CommissionService } from "../commission/commission.service";
import { SalonCodesService } from "../salon-codes/salon-codes.service";
import { SettingsService } from "../settings/settings.service";
import { PrismaService } from "../prisma/prisma.service";

function hashPassword(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

function generateOrderNumber(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.floor(Math.random() * 100000).toString().padStart(5, "0");
  return `BU-${date}-${rand}`;
}

async function makeReferralCode(prisma: PrismaService): Promise<string> {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  // eslint-disable-next-line no-constant-condition
  while (true) {
    let code = "BU-";
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    const existing = await prisma.member.findFirst({ where: { referralCode: code } });
    if (!existing) return code;
  }
}

@Injectable()
export class MobileService {
  private readonly logger = new Logger(MobileService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly commissionService: CommissionService,
    private readonly salonCodesService: SalonCodesService,
    private readonly flowAccountService: FlowAccountService,
    private readonly omiseService: OmiseService,
    private readonly settingsService: SettingsService,
  ) {}

  async getConfig() {
    const gatewayFee = await this.settingsService.getValue("gateway_fee");
    return { gatewayFee };
  }

  async register(payload: {
    fullName: string;
    email?: string;
    phone?: string;
    password: string;
    referralCode?: string;
    salonCode?: string;
  }) {
    if (!payload.email && !payload.phone) {
      throw new BadRequestException("กรุณากรอกอีเมลหรือเบอร์โทร");
    }

    if (payload.email) {
      const existing = await this.prisma.member.findUnique({ where: { email: payload.email } });
      if (existing) throw new BadRequestException("อีเมลนี้ถูกใช้งานแล้ว");
    }
    if (payload.phone) {
      const existing = await this.prisma.member.findUnique({ where: { phone: payload.phone } });
      if (existing) throw new BadRequestException("เบอร์โทรนี้ถูกใช้งานแล้ว");
    }

    let referredById: string | undefined;
    if (payload.referralCode) {
      const referrer = await this.prisma.member.findFirst({
        where: { referralCode: payload.referralCode, isActive: true },
      });
      if (referrer) referredById = referrer.id;
    }

    let salonCodeId: string | undefined;
    let memberType: "REGULAR" | "SALON" = "REGULAR";
    if (payload.salonCode) {
      const sc = await this.salonCodesService.validate(payload.salonCode);
      if (!sc) throw new BadRequestException("Salon Code ไม่ถูกต้องหรือหมดอายุแล้ว");
      salonCodeId = sc.id;
      memberType = "SALON";
    }

    const myReferralCode = await makeReferralCode(this.prisma);

    const member = await this.prisma.member.create({
      data: {
        fullName: payload.fullName,
        email: payload.email ?? undefined,
        phone: payload.phone ?? undefined,
        passwordHash: hashPassword(payload.password),
        referredById,
        referralCode: myReferralCode,
        memberType,
        salonCodeId,
      },
    });

    if (salonCodeId) {
      await this.salonCodesService.incrementUsed(salonCodeId);
    }

    const token = generateToken();
    await this.prisma.memberSession.create({ data: { memberId: member.id, token } });

    // sync to FlowAccount in background — failure does not block registration
    this.flowAccountService.createContact({
      fullName: member.fullName,
      email: member.email,
      phone: member.phone,
    }).then(async (contactId) => {
      if (!contactId) return;
      this.logger.log(`FlowAccount contact created: ${contactId} for member ${member.id}`);
      await this.prisma.member.update({
        where: { id: member.id },
        data: { flowAccountContactId: contactId },
      });
    }).catch((err) => {
      this.logger.error(`FlowAccount sync failed for member ${member.id}`, err);
    });

    return { token, member: this.safeProfile(member) };
  }

  async login(payload: { identifier: string; password: string }) {
    const isEmail = payload.identifier.includes("@");
    const member = isEmail
      ? await this.prisma.member.findUnique({ where: { email: payload.identifier } })
      : await this.prisma.member.findFirst({ where: { phone: payload.identifier } });

    if (!member || !member.passwordHash || !member.isActive) {
      throw new UnauthorizedException("อีเมล/เบอร์โทร หรือรหัสผ่านไม่ถูกต้อง");
    }

    if (hashPassword(payload.password) !== member.passwordHash) {
      throw new UnauthorizedException("อีเมล/เบอร์โทร หรือรหัสผ่านไม่ถูกต้อง");
    }

    const token = generateToken();
    await this.prisma.memberSession.create({ data: { memberId: member.id, token } });

    return { token, member: this.safeProfile(member) };
  }

  async getProfile(memberId: string) {
    const member = await this.prisma.member.findUnique({ where: { id: memberId } });
    if (!member) throw new UnauthorizedException();
    return this.safeProfile(member);
  }

  async checkout(memberId: string, payload: {
    items: { productId: string; quantity: number }[];
    shippingName: string;
    shippingPhone: string;
    shippingAddr: string;
    omiseToken: string;
  }) {
    const productIds = payload.items.map((i) => i.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, status: "ACTIVE" },
    });

    if (products.length !== payload.items.length) {
      throw new BadRequestException("พบสินค้าที่ไม่พร้อมขาย");
    }

    for (const item of payload.items) {
      const product = products.find((p) => p.id === item.productId)!;
      if (product.sellableStock < item.quantity) {
        throw new BadRequestException(`สินค้า "${product.name}" มีจำนวนไม่เพียงพอ`);
      }
    }

    const orderItems = payload.items.map((item) => {
      const product = products.find((p) => p.id === item.productId)!;
      const unitPrice = Number(product.specialPrice ?? product.price);
      return {
        productId: product.id,
        sku: product.sku,
        name: product.name,
        quantity: item.quantity,
        unitPrice,
        totalPrice: unitPrice * item.quantity,
      };
    });

    const subtotal = orderItems.reduce((s, i) => s + i.totalPrice, 0);
    const shippingAmount = 0;
    const gatewayFee = await this.settingsService.getValue("gateway_fee");
    const totalAmount = subtotal + shippingAmount + gatewayFee;

    // ── Charge via Omise (throws on failure — order is NOT created) ─────────────
    let charge: Awaited<ReturnType<typeof this.omiseService.createCharge>>;
    try {
      charge = await this.omiseService.createCharge({
        token: payload.omiseToken,
        amountTHB: totalAmount,
        description: `Beauty Up order for ${payload.shippingName}`,
      });
    } catch (err) {
      throw new BadRequestException(
        err instanceof Error ? err.message : "การชำระเงินไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
      );
    }

    if (charge.status !== "successful") {
      throw new BadRequestException(
        charge.failure_message ?? "การชำระเงินไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
      );
    }

    const [order] = await this.prisma.$transaction([
      this.prisma.order.create({
        data: {
          orderNumber: generateOrderNumber(),
          memberId,
          status: "PAID",
          subtotalAmount: subtotal,
          shippingAmount,
          gatewayFee,
          totalAmount,
          shippingName: payload.shippingName,
          shippingPhone: payload.shippingPhone,
          shippingAddr: payload.shippingAddr,
          chargeId: charge.id,
          items: { create: orderItems },
        },
        include: { items: true },
      }),
      ...orderItems.map((item) =>
        this.prisma.product.update({
          where: { id: item.productId },
          data: { sellableStock: { decrement: item.quantity } },
        }),
      ),
    ]);

    await this.commissionService.createForOrder(order.id);

    // sync to FlowAccount in background — failure does not block checkout
    this.syncOrderToFlowAccount(order, memberId).catch((err) =>
      this.logger.error(`[FlowAccount order sync] FAILED for order ${order.id}: ${String(err)}`),
    );

    return order;
  }

  private async syncOrderToFlowAccount(
    order: { id: string; orderNumber: string; createdAt: Date; subtotalAmount: unknown; totalAmount: unknown; items: { name: string; quantity: number; unitPrice: unknown; totalPrice: unknown }[] },
    memberId: string,
  ): Promise<void> {
    const member = await this.prisma.member.findUnique({
      where: { id: memberId },
      select: { fullName: true, email: true, phone: true, flowAccountContactId: true },
    });

    const result = await this.flowAccountService.createReceipt({
      orderNumber: order.orderNumber,
      orderId: order.id,
      publishedOn: new Date(order.createdAt).toISOString().slice(0, 10),
      contactId: member?.flowAccountContactId ?? null,
      contactName: member?.fullName ?? 'ลูกค้า',
      contactEmail: member?.email,
      contactPhone: member?.phone,
      subtotal: Number(order.subtotalAmount),
      grandTotal: Number(order.totalAmount),
      items: order.items.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        pricePerUnit: Number(i.unitPrice),
        total: Number(i.totalPrice),
      })),
    });

    if (result) {
      await this.prisma.order.update({
        where: { id: order.id },
        data: {
          flowAccountDocId: result.taxInvoiceId,
          flowAccountReceiptId: result.receiptId || null,
        },
      });
      this.logger.log(`[FlowAccount order sync] SUCCESS taxInvoiceId=${result.taxInvoiceId} receiptId=${result.receiptId} for order ${order.id}`);
    }
  }

  async getDocumentUrls(orderNumber: string, memberId: string): Promise<{ taxInvoiceUrl: string | null; receiptUrl: string | null }> {
    const order = await this.prisma.order.findFirst({ where: { orderNumber, memberId } });
    if (!order) return { taxInvoiceUrl: null, receiptUrl: null };

    const [taxInvoiceUrl, receiptUrl] = await Promise.all([
      order.flowAccountDocId
        ? this.flowAccountService.getShareLink(order.flowAccountDocId, 'tax-invoice')
        : null,
      order.flowAccountReceiptId
        ? this.flowAccountService.getShareLink(order.flowAccountReceiptId, 'receipt')
        : null,
    ]);

    return { taxInvoiceUrl, receiptUrl };
  }

  async getOrders(memberId: string) {
    return this.prisma.order.findMany({
      where: { memberId },
      include: { items: true },
      orderBy: { createdAt: "desc" },
    });
  }

  // ─── Addresses ────────────────────────────────────────────────────────────────

  private syncDefaultAddressToFlowAccount(memberId: string, address: {
    addressLine1: string;
    addressLine2?: string | null;
    district?: string | null;
    province?: string | null;
    postalCode?: string | null;
  }): void {
    this.logger.debug(`[syncAddress] START memberId=${memberId}`);
    this.logger.debug(`[syncAddress] address=${JSON.stringify(address)}`);
    this.prisma.member.findUnique({ where: { id: memberId }, select: { flowAccountContactId: true, fullName: true, email: true, phone: true } })
      .then((m) => {
        this.logger.debug(`[syncAddress] flowAccountContactId=${m?.flowAccountContactId ?? 'null'}`);
        if (!m?.flowAccountContactId) {
          this.logger.warn(`[syncAddress] skipped — member has no flowAccountContactId`);
          return;
        }
        return this.flowAccountService.updateContactAddress(m.flowAccountContactId, m.fullName, m.email, m.phone, address);
      })
      .catch((err) => this.logger.error(`[syncAddress] FAILED for member ${memberId}: ${String(err)}`));
  }

  async listAddresses(memberId: string) {
    return this.prisma.memberAddress.findMany({
      where: { memberId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    });
  }

  async createAddress(
    memberId: string,
    payload: {
      label?: string;
      recipient: string;
      phone: string;
      addressLine1: string;
      addressLine2?: string;
      district?: string;
      province?: string;
      postalCode?: string;
      isDefault?: boolean;
    },
  ) {
    if (payload.isDefault) {
      await this.prisma.memberAddress.updateMany({ where: { memberId }, data: { isDefault: false } });
    }
    const isFirst = (await this.prisma.memberAddress.count({ where: { memberId } })) === 0;
    const isDefault = payload.isDefault ?? isFirst;
    const created = await this.prisma.memberAddress.create({
      data: { ...payload, memberId, isDefault },
    });
    if (isDefault) this.syncDefaultAddressToFlowAccount(memberId, created);
    return created;
  }

  async updateAddress(
    memberId: string,
    addressId: string,
    payload: {
      label?: string;
      recipient?: string;
      phone?: string;
      addressLine1?: string;
      addressLine2?: string;
      district?: string;
      province?: string;
      postalCode?: string;
      isDefault?: boolean;
    },
  ) {
    const addr = await this.prisma.memberAddress.findFirst({ where: { id: addressId, memberId } });
    if (!addr) throw new BadRequestException("ไม่พบที่อยู่");
    if (payload.isDefault) {
      await this.prisma.memberAddress.updateMany({ where: { memberId }, data: { isDefault: false } });
    }
    const updated = await this.prisma.memberAddress.update({ where: { id: addressId }, data: payload });
    if (updated.isDefault) this.syncDefaultAddressToFlowAccount(memberId, updated);
    return updated;
  }

  async deleteAddress(memberId: string, addressId: string) {
    const addr = await this.prisma.memberAddress.findFirst({ where: { id: addressId, memberId } });
    if (!addr) throw new BadRequestException("ไม่พบที่อยู่");
    await this.prisma.memberAddress.delete({ where: { id: addressId } });
    if (addr.isDefault) {
      const next = await this.prisma.memberAddress.findFirst({ where: { memberId }, orderBy: { createdAt: "asc" } });
      if (next) await this.prisma.memberAddress.update({ where: { id: next.id }, data: { isDefault: true } });
    }
    return { success: true };
  }

  async setDefaultAddress(memberId: string, addressId: string) {
    const addr = await this.prisma.memberAddress.findFirst({ where: { id: addressId, memberId } });
    if (!addr) throw new BadRequestException("ไม่พบที่อยู่");
    await this.prisma.memberAddress.updateMany({ where: { memberId }, data: { isDefault: false } });
    const updated = await this.prisma.memberAddress.update({ where: { id: addressId }, data: { isDefault: true } });
    this.syncDefaultAddressToFlowAccount(memberId, updated);
    return updated;
  }

  async initiatePromptPay(memberId: string, payload: {
    items: { productId: string; quantity: number }[];
    shippingName: string;
    shippingPhone: string;
    shippingAddr: string;
  }): Promise<{ chargeId: string; svgContent: string; expiresAt: string }> {
    const productIds = payload.items.map((i) => i.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, status: "ACTIVE" },
    });

    if (products.length !== payload.items.length) {
      throw new BadRequestException("พบสินค้าที่ไม่พร้อมขาย");
    }

    for (const item of payload.items) {
      const product = products.find((p) => p.id === item.productId)!;
      if (product.sellableStock < item.quantity) {
        throw new BadRequestException(`สินค้า "${product.name}" มีจำนวนไม่เพียงพอ`);
      }
    }

    const orderItems = payload.items.map((item) => {
      const product = products.find((p) => p.id === item.productId)!;
      const unitPrice = Number(product.specialPrice ?? product.price);
      return {
        productId: product.id,
        sku: product.sku,
        name: product.name,
        quantity: item.quantity,
        unitPrice,
        totalPrice: unitPrice * item.quantity,
      };
    });

    const subtotal = orderItems.reduce((s, i) => s + i.totalPrice, 0);
    const gatewayFee = await this.settingsService.getValue("gateway_fee");
    const totalAmount = subtotal + gatewayFee;

    const member = await this.prisma.member.findUnique({ where: { id: memberId }, select: { fullName: true } });

    const result = await this.omiseService.createPromptPayCharge({
      amountTHB: totalAmount,
      description: `Beauty Up order for ${member?.fullName ?? memberId}`,
    });

    await this.prisma.pendingCheckout.create({
      data: {
        chargeId: result.chargeId,
        memberId,
        checkoutData: {
          items: orderItems,
          subtotal,
          gatewayFee,
          totalAmount,
          shippingName: payload.shippingName,
          shippingPhone: payload.shippingPhone,
          shippingAddr: payload.shippingAddr,
        },
        expiresAt: new Date(result.expiresAt),
      },
    });

    return result;
  }

  async checkPromptPay(chargeId: string, memberId: string): Promise<{ status: string; order?: object }> {
    const pending = await this.prisma.pendingCheckout.findUnique({ where: { chargeId } });
    if (!pending || pending.memberId !== memberId) {
      throw new BadRequestException("ไม่พบรายการชำระเงิน");
    }

    // Prevent duplicate order creation
    const existingOrder = await this.prisma.order.findFirst({ where: { chargeId } });
    if (existingOrder) {
      await this.prisma.pendingCheckout.deleteMany({ where: { chargeId } });
      return { status: "successful", order: existingOrder };
    }

    const charge = await this.omiseService.getCharge(chargeId);

    if (charge.status === "successful") {
      type CheckoutData = {
        items: { productId: string; sku: string; name: string; quantity: number; unitPrice: number; totalPrice: number }[];
        subtotal: number;
        gatewayFee: number;
        totalAmount: number;
        shippingName: string;
        shippingPhone: string;
        shippingAddr: string;
      };
      const data = pending.checkoutData as CheckoutData;

      const [order] = await this.prisma.$transaction([
        this.prisma.order.create({
          data: {
            orderNumber: generateOrderNumber(),
            memberId,
            status: "PAID",
            subtotalAmount: data.subtotal,
            shippingAmount: 0,
            gatewayFee: data.gatewayFee,
            totalAmount: data.totalAmount,
            shippingName: data.shippingName,
            shippingPhone: data.shippingPhone,
            shippingAddr: data.shippingAddr,
            chargeId,
            items: { create: data.items },
          },
          include: { items: true },
        }),
        ...data.items.map((item) =>
          this.prisma.product.update({
            where: { id: item.productId },
            data: { sellableStock: { decrement: item.quantity } },
          }),
        ),
      ]);

      await this.prisma.pendingCheckout.delete({ where: { chargeId } });
      await this.commissionService.createForOrder(order.id);
      this.syncOrderToFlowAccount(order, memberId).catch((err) =>
        this.logger.error(`[FlowAccount promptpay sync] FAILED: ${String(err)}`),
      );

      return { status: "successful", order };
    }

    if (charge.status === "failed" || charge.status === "expired") {
      await this.prisma.pendingCheckout.deleteMany({ where: { chargeId } });
    }

    return { status: charge.status };
  }

  async validateToken(token: string) {
    const session = await this.prisma.memberSession.findUnique({
      where: { token },
      include: { member: true },
    });
    if (!session || !session.member.isActive) throw new UnauthorizedException();
    return session.member;
  }

  private safeProfile(member: {
    id: string;
    fullName: string;
    email: string | null;
    phone: string | null;
    memberType: string;
    pointBalance: number;
    [key: string]: unknown;
  }) {
    return {
      id: member.id,
      fullName: member.fullName,
      email: member.email,
      phone: member.phone,
      memberType: member.memberType,
      pointBalance: member.pointBalance,
      referralCode: (member.referralCode as string | null) ?? null,
    };
  }
}
