import { BadRequestException, Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { createHash, randomBytes } from "crypto";
import { FlowAccountService } from "../flowaccount/flowaccount.service";
import { CommissionService } from "../commission/commission.service";
import { SalonCodesService } from "../salon-codes/salon-codes.service";
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
  ) {}

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
  }) {
    const productIds = payload.items.map((i) => i.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, status: "ACTIVE" },
    });

    if (products.length !== payload.items.length) {
      throw new BadRequestException("พบสินค้าที่ไม่พร้อมขาย");
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
    const totalAmount = subtotal + shippingAmount;

    const [order] = await this.prisma.$transaction([
      this.prisma.order.create({
        data: {
          orderNumber: generateOrderNumber(),
          memberId,
          status: "PAID",
          subtotalAmount: subtotal,
          shippingAmount,
          totalAmount,
          shippingName: payload.shippingName,
          shippingPhone: payload.shippingPhone,
          shippingAddr: payload.shippingAddr,
          items: { create: orderItems },
        },
        include: { items: true },
      }),
      ...orderItems.map((item) =>
        this.prisma.product.update({
          where: { id: item.productId },
          data: {
            stock: { decrement: item.quantity },
            sellableStock: { decrement: item.quantity },
          },
        }),
      ),
    ]);

    await this.commissionService.createForOrder(order.id);

    return order;
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
    this.prisma.member.findUnique({ where: { id: memberId }, select: { flowAccountContactId: true } })
      .then((m) => {
        if (!m?.flowAccountContactId) return;
        return this.flowAccountService.updateContactAddress(m.flowAccountContactId, address);
      })
      .catch((err) => this.logger.error(`FlowAccount address sync failed for member ${memberId}`, err));
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
