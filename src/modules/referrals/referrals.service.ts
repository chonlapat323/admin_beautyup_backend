import { Injectable } from "@nestjs/common";
import { CommissionStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ReferralsService {
  constructor(private readonly prisma: PrismaService) {}

  async summary() {
    const [totalReferrals, pending, paid] = await Promise.all([
      this.prisma.member.count({ where: { referredById: { not: null } } }),
      this.prisma.commission.aggregate({
        where: { status: CommissionStatus.PENDING },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.commission.aggregate({
        where: { status: CommissionStatus.PAID },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    return {
      totalReferrals,
      pendingCommission: Number(pending._sum.amount ?? 0),
      pendingCount: pending._count,
      paidCommission: Number(paid._sum.amount ?? 0),
      paidCount: paid._count,
    };
  }

  async history() {
    const rows = await this.prisma.member.findMany({
      where: { referredById: { not: null } },
      select: {
        id: true,
        fullName: true,
        memberType: true,
        createdAt: true,
        referredBy: { select: { id: true, fullName: true, referralCode: true } },
        orders: {
          select: {
            commissions: {
              select: { amount: true, status: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return rows.map((member) => {
      const allCommissions = member.orders.flatMap((o) => o.commissions);
      const totalCommission = allCommissions.reduce((sum, c) => sum + Number(c.amount), 0);
      const pendingCommission = allCommissions
        .filter((c) => c.status === CommissionStatus.PENDING)
        .reduce((sum, c) => sum + Number(c.amount), 0);

      return {
        referredMemberId: member.id,
        referredMemberName: member.fullName,
        referredMemberType: member.memberType,
        joinedAt: member.createdAt,
        referrerId: member.referredBy!.id,
        referrerName: member.referredBy!.fullName,
        referralCode: member.referredBy!.referralCode,
        totalCommission,
        pendingCommission,
      };
    });
  }
}
