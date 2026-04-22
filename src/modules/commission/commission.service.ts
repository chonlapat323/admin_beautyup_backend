import { Injectable } from "@nestjs/common";
import { CommissionStatus, MemberType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

const COMMISSION_RATES: Record<MemberType, number> = {
  SALON: 10,
  REGULAR: 5,
};

@Injectable()
export class CommissionService {
  constructor(private readonly prisma: PrismaService) {}

  async createForOrder(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { member: { include: { referredBy: true } } },
    });

    if (!order?.member?.referredBy) return null;

    const referrer = order.member.referredBy;
    const rate = COMMISSION_RATES[referrer.memberType];
    const amount = (Number(order.totalAmount) * rate) / 100;

    return this.prisma.commission.create({
      data: {
        earnerId: referrer.id,
        orderId: order.id,
        orderAmount: order.totalAmount,
        rate,
        amount: Math.round(amount * 100) / 100,
      },
    });
  }

  async findAll(params: {
    status?: CommissionStatus;
    earnerId?: string;
    page: number;
    pageSize: number;
  }) {
    const where: Record<string, unknown> = {};
    if (params.status) where.status = params.status;
    if (params.earnerId) where.earnerId = params.earnerId;

    const [items, totalItems] = await this.prisma.$transaction([
      this.prisma.commission.findMany({
        where,
        include: {
          earner: { select: { id: true, fullName: true, memberType: true } },
          order: { select: { orderNumber: true, totalAmount: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      this.prisma.commission.count({ where }),
    ]);

    const totalPages = Math.max(1, Math.ceil(totalItems / params.pageSize));
    return { items, meta: { page: params.page, pageSize: params.pageSize, totalItems, totalPages } };
  }

  async markPaid(ids: string[], note?: string) {
    return this.prisma.commission.updateMany({
      where: { id: { in: ids }, status: CommissionStatus.PENDING },
      data: { status: CommissionStatus.PAID, paidAt: new Date(), note },
    });
  }

  async cancel(id: string) {
    return this.prisma.commission.update({
      where: { id },
      data: { status: CommissionStatus.CANCELLED },
    });
  }

  async summary(earnerId: string) {
    const [pending, paid] = await Promise.all([
      this.prisma.commission.aggregate({
        where: { earnerId, status: CommissionStatus.PENDING },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.commission.aggregate({
        where: { earnerId, status: CommissionStatus.PAID },
        _sum: { amount: true },
        _count: true,
      }),
    ]);
    return {
      pendingAmount: Number(pending._sum.amount ?? 0),
      pendingCount: pending._count,
      paidAmount: Number(paid._sum.amount ?? 0),
      paidCount: paid._count,
    };
  }
}
