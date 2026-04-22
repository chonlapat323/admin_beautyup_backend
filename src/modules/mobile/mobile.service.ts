import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import { createHash, randomBytes } from "crypto";
import { CommissionService } from "../commission/commission.service";
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly commissionService: CommissionService,
  ) {}

  async register(payload: {
    fullName: string;
    identifier: string;
    password: string;
    referralCode?: string;
  }) {
    console.log("[register] payload received:", JSON.stringify({ fullName: payload.fullName, identifier: payload.identifier, hasReferralCode: !!payload.referralCode }));
    const isEmail = payload.identifier.includes("@");
    console.log("[register] isEmail:", isEmail, "→ will set", isEmail ? "email" : "phone", "=", payload.identifier);
    const existing = isEmail
      ? await this.prisma.member.findUnique({ where: { email: payload.identifier } })
      : await this.prisma.member.findUnique({ where: { phone: payload.identifier } });

    if (existing) throw new BadRequestException("อีเมลหรือเบอร์โทรนี้ถูกใช้งานแล้ว");

    // หา referrer จาก referralCode
    let referredById: string | undefined;
    if (payload.referralCode) {
      const referrer = await this.prisma.member.findFirst({
        where: { referralCode: payload.referralCode, isActive: true },
      });
      if (referrer) referredById = referrer.id;
    }

    const myReferralCode = await makeReferralCode(this.prisma);

    const createData = {
      fullName: payload.fullName,
      email: isEmail ? payload.identifier : undefined,
      phone: !isEmail ? payload.identifier : undefined,
      passwordHash: hashPassword(payload.password),
      referredById,
      referralCode: myReferralCode,
    };
    console.log("[register] creating member with:", JSON.stringify({ fullName: createData.fullName, email: createData.email, phone: createData.phone, referralCode: createData.referralCode }));

    const member = await this.prisma.member.create({ data: createData });
    console.log("[register] member created:", JSON.stringify({ id: member.id, email: member.email, phone: member.phone }));

    const token = generateToken();
    await this.prisma.memberSession.create({ data: { memberId: member.id, token } });

    return { token, member: this.safeProfile(member) };
  }

  async login(payload: { identifier: string; password: string }) {
    const isEmail = payload.identifier.includes("@");
    const member = isEmail
      ? await this.prisma.member.findUnique({ where: { email: payload.identifier } })
      : await this.prisma.member.findUnique({ where: { phone: payload.identifier } });

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

    const order = await this.prisma.order.create({
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
    });

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
