import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class StockService {
  constructor(private readonly prisma: PrismaService) {}

  async summary() {
    return this.prisma.product.findMany({
      select: {
        id: true,
        sku: true,
        name: true,
        stock: true,
        reserveStock: true,
        sellableStock: true,
        status: true,
      },
      orderBy: { name: "asc" },
    });
  }

  async adjust(dto: { productId: string; delta: number; reason: string }) {
    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: dto.productId } });
      if (!product) throw new NotFoundException("ไม่พบสินค้า");

      const newStock = Math.max(0, product.stock + dto.delta);
      const newReserve = Math.ceil(newStock * 0.1);
      const newSellable = newStock - newReserve;

      await tx.product.update({
        where: { id: dto.productId },
        data: { stock: newStock, reserveStock: newReserve, sellableStock: newSellable },
      });

      await tx.stockMovement.create({
        data: { productId: dto.productId, delta: dto.delta, reason: dto.reason, type: "ADJUSTMENT" },
      });

      return { productId: dto.productId, stock: newStock, reserveStock: newReserve, sellableStock: newSellable };
    });
  }

  async movements(productId?: string) {
    return this.prisma.stockMovement.findMany({
      where: productId ? { productId } : undefined,
      include: { product: { select: { name: true, sku: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }

  async decrementForOrder(
    orderId: string,
    tx: Parameters<Parameters<PrismaService["$transaction"]>[0]>[0],
  ) {
    const items = await tx.orderItem.findMany({ where: { orderId } });
    for (const item of items) {
      const product = await tx.product.findUnique({ where: { id: item.productId } });
      if (!product) continue;
      const newStock = Math.max(0, product.stock - item.quantity);
      const newReserve = Math.ceil(newStock * 0.1);
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: newStock, reserveStock: newReserve, sellableStock: newStock - newReserve },
      });
      await tx.stockMovement.create({
        data: {
          productId: item.productId,
          delta: -item.quantity,
          reason: `ออเดอร์ ${orderId}`,
          type: "SALE",
        },
      });
    }
  }
}
