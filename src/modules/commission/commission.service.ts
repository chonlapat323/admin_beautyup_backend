import { Injectable } from "@nestjs/common";
import { CommissionStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

const DEFAULT_RATES = { SALON: 10, REGULAR: 5 };
const RATE_KEY = { SALON: "commission.rate.SALON", REGULAR: "commission.rate.REGULAR" };

@Injectable()
export class CommissionService {
  constructor(private readonly prisma: PrismaService) {}

  async getRates(): Promise<{ salon: number; regular: number }> {
    const rows = await this.prisma.setting.findMany({
      where: { key: { in: [RATE_KEY.SALON, RATE_KEY.REGULAR] } },
    });
    const map = Object.fromEntries(rows.map((r) => [r.key, Number(r.value)]));
    return {
      salon: map[RATE_KEY.SALON] ?? DEFAULT_RATES.SALON,
      regular: map[RATE_KEY.REGULAR] ?? DEFAULT_RATES.REGULAR,
    };
  }

  async updateRates(salon: number, regular: number) {
    await this.prisma.$transaction([
      this.prisma.setting.upsert({
        where: { key: RATE_KEY.SALON },
        create: { key: RATE_KEY.SALON, value: String(salon) },
        update: { value: String(salon) },
      }),
      this.prisma.setting.upsert({
        where: { key: RATE_KEY.REGULAR },
        create: { key: RATE_KEY.REGULAR, value: String(regular) },
        update: { value: String(regular) },
      }),
    ]);
    return { salon, regular };
  }

  async createForOrder(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { member: { include: { referredBy: true } } },
    });

    if (!order?.member?.referredBy) return null;

    const referrer = order.member.referredBy;
    const rates = await this.getRates();
    const rate = referrer.memberType === "SALON" ? rates.salon : rates.regular;
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

  async markPaid(ids: string[], opts?: { note?: string; method?: string; reference?: string }) {
    const commissions = await this.prisma.commission.findMany({
      where: { id: { in: ids }, status: CommissionStatus.PENDING },
      select: { id: true, earnerId: true, amount: true },
    });

    if (commissions.length === 0) return { count: 0, payout: null };

    // Group by earner — one payout log per earner per call
    const byEarner = new Map<string, { ids: string[]; total: number }>();
    for (const c of commissions) {
      const entry = byEarner.get(c.earnerId) ?? { ids: [], total: 0 };
      entry.ids.push(c.id);
      entry.total += Number(c.amount);
      byEarner.set(c.earnerId, entry);
    }

    const now = new Date();
    const payouts = await this.prisma.$transaction(async (tx) => {
      const created: Awaited<ReturnType<typeof tx.commissionPayout.create>>[] = [];
      for (const [earnerId, { ids: earnedIds, total }] of byEarner) {
        const payout = await tx.commissionPayout.create({
          data: {
            memberId: earnerId,
            totalAmount: total,
            method: opts?.method ?? "BANK_TRANSFER",
            reference: opts?.reference,
            note: opts?.note,
          },
        });
        await tx.commission.updateMany({
          where: { id: { in: earnedIds } },
          data: { status: CommissionStatus.PAID, paidAt: now, payoutId: payout.id, note: opts?.note },
        });
        created.push(payout);
      }
      return created;
    });

    return { count: commissions.length, payouts };
  }

  async findPayouts(params: { memberId?: string; page: number; pageSize: number }) {
    const where = params.memberId ? { memberId: params.memberId } : {};
    const [items, totalItems] = await this.prisma.$transaction([
      this.prisma.commissionPayout.findMany({
        where,
        include: {
          member: { select: { id: true, fullName: true } },
          commissions: { select: { id: true, amount: true, orderId: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      this.prisma.commissionPayout.count({ where }),
    ]);
    const totalPages = Math.max(1, Math.ceil(totalItems / params.pageSize));
    return { items, meta: { page: params.page, pageSize: params.pageSize, totalItems, totalPages } };
  }

  async cancel(id: string) {
    return this.prisma.commission.update({
      where: { id },
      data: { status: CommissionStatus.CANCELLED },
    });
  }

  async report(period: "day" | "week" | "month", fromStr?: string, toStr?: string) {
    const now = new Date();
    let from: Date;
    let to: Date | undefined;

    if (fromStr) {
      from = new Date(fromStr);
    } else if (period === "day") {
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
    } else if (period === "week") {
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 13 * 7);
    } else {
      from = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    }

    if (toStr) {
      to = new Date(new Date(toStr).setHours(23, 59, 59, 999));
    }

    const rows = await this.prisma.commission.findMany({
      where: {
        createdAt: { gte: from, ...(to ? { lte: to } : {}) },
        status: { not: "CANCELLED" },
      },
      include: { earner: { select: { id: true, fullName: true, memberType: true, referralCode: true } } },
      orderBy: { createdAt: "desc" },
    });

    // group by period bucket + earner
    const bucketMap = new Map<string, {
      bucket: string;
      earnerId: string;
      earnerName: string;
      memberType: string;
      referralCode: string | null;
      count: number;
      totalAmount: number;
    }>();

    for (const row of rows) {
      const d = new Date(row.createdAt);
      let bucket: string;
      if (period === "day") {
        bucket = d.toISOString().slice(0, 10);
      } else if (period === "week") {
        const weekStart = new Date(d);
        weekStart.setDate(d.getDate() - d.getDay());
        bucket = weekStart.toISOString().slice(0, 10);
      } else {
        bucket = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      }

      const key = `${bucket}__${row.earnerId}`;
      const existing = bucketMap.get(key);
      if (existing) {
        existing.count += 1;
        existing.totalAmount += Number(row.amount);
      } else {
        bucketMap.set(key, {
          bucket,
          earnerId: row.earnerId,
          earnerName: row.earner.fullName,
          memberType: row.earner.memberType,
          referralCode: row.earner.referralCode,
          count: 1,
          totalAmount: Number(row.amount),
        });
      }
    }

    return Array.from(bucketMap.values()).sort((a, b) =>
      b.bucket.localeCompare(a.bucket) || b.totalAmount - a.totalAmount,
    );
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
