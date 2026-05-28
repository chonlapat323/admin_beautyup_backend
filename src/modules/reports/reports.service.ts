import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

type DateRange = { dateFrom?: string; dateTo?: string };

function buildDateWhere(range: DateRange): Prisma.DateTimeFilter | undefined {
  if (!range.dateFrom && !range.dateTo) return undefined;
  const filter: Prisma.DateTimeFilter = {};
  if (range.dateFrom) filter.gte = new Date(range.dateFrom);
  if (range.dateTo) {
    const to = new Date(range.dateTo);
    to.setHours(23, 59, 59, 999);
    filter.lte = to;
  }
  return filter;
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async salesByProduct(range: DateRange) {
    const createdAt = buildDateWhere(range);
    const orderWhere: Prisma.OrderWhereInput = { status: "PAID" };
    if (createdAt) orderWhere.createdAt = createdAt;

    const items = await this.prisma.orderItem.findMany({
      where: { order: orderWhere },
      select: { productId: true, sku: true, name: true, quantity: true, totalPrice: true },
    });

    const map = new Map<string, { productId: string; name: string; sku: string; quantity: number; revenue: number }>();
    for (const item of items) {
      const cur = map.get(item.productId) ?? {
        productId: item.productId, name: item.name, sku: item.sku, quantity: 0, revenue: 0,
      };
      cur.quantity += item.quantity;
      cur.revenue += Number(item.totalPrice);
      map.set(item.productId, cur);
    }

    return [...map.values()].sort((a, b) => b.revenue - a.revenue);
  }

  async salesByMember(range: DateRange) {
    const createdAt = buildDateWhere(range);
    const where: Prisma.OrderWhereInput = { status: "PAID", memberId: { not: null } };
    if (createdAt) where.createdAt = createdAt;

    const orders = await this.prisma.order.findMany({
      where,
      select: {
        memberId: true,
        totalAmount: true,
        member: { select: { fullName: true, email: true, memberType: true } },
      },
    });

    const map = new Map<string, { memberId: string; name: string; email: string; memberType: string; orderCount: number; totalSpent: number }>();
    for (const order of orders) {
      if (!order.memberId || !order.member) continue;
      const cur = map.get(order.memberId) ?? {
        memberId: order.memberId,
        name: order.member.fullName,
        email: order.member.email ?? "",
        memberType: order.member.memberType ?? "REGULAR",
        orderCount: 0,
        totalSpent: 0,
      };
      cur.orderCount++;
      cur.totalSpent += Number(order.totalAmount);
      map.set(order.memberId, cur);
    }

    return [...map.values()].sort((a, b) => b.totalSpent - a.totalSpent);
  }

  async stockReport(brandId?: string) {
    const where: Prisma.ProductWhereInput = {};
    if (brandId) where.brandId = brandId;

    const products = await this.prisma.product.findMany({
      where,
      select: {
        id: true,
        name: true,
        sku: true,
        stock: true,
        brand: { select: { id: true, name: true } },
      },
      orderBy: { stock: "asc" },
    });

    const productIds = products.map((p) => p.id);
    const soldItems = productIds.length > 0
      ? await this.prisma.orderItem.groupBy({
          by: ["productId"],
          where: { productId: { in: productIds }, order: { status: "PAID" } },
          _sum: { quantity: true },
        })
      : [];

    const soldMap = new Map(soldItems.map((s) => [s.productId, s._sum.quantity ?? 0]));

    return products.map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      stock: p.stock,
      brandId: p.brand?.id ?? null,
      brandName: p.brand?.name ?? null,
      soldQuantity: soldMap.get(p.id) ?? 0,
      status: p.stock === 0 ? "OUT_OF_STOCK" : p.stock <= 5 ? "LOW" : "NORMAL",
    }));
  }

}
