import { Injectable, Logger } from "@nestjs/common";
import { AuditLogService } from "../audit-log/audit-log.service";
import { CommissionService } from "../commission/commission.service";
import { PrismaService } from "../prisma/prisma.service";
import { StockService } from "../stock/stock.service";

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly commissionService: CommissionService,
    private readonly stockService: StockService,
    private readonly auditLog: AuditLogService,
  ) {}

  async findAll() {
    return this.prisma.order.findMany({
      include: {
        member: { select: { fullName: true, email: true, phone: true, storeName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }

  async findOne(id: string) {
    return this.prisma.order.findUnique({
      where: { id },
      include: {
        member: { select: { fullName: true, email: true, phone: true, storeName: true } },
        items: {
          include: {
            product: {
              select: {
                name: true,
                sku: true,
                images: { select: { url: true }, orderBy: { sortOrder: "asc" }, take: 1 },
              },
            },
          },
        },
        statusLogs: { orderBy: { createdAt: "desc" } },
      },
    });
  }

  async updateStatus(id: string, status: string, changedByName: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      select: { status: true, memberId: true, pointEarned: true },
    });
    if (!order) throw new Error("Order not found");

    const isFirstDelivered = status === "DELIVERED" && order.status !== "DELIVERED";
    const isFirstPaid = status === "PAID" && order.status !== "PAID";

    const awardPoints =
      isFirstDelivered &&
      order.pointEarned > 0 &&
      order.memberId !== null;

    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.order.update({
        where: { id },
        data: { status: status as never },
      });
      await tx.orderStatusLog.create({
        data: {
          orderId: id,
          fromStatus: order.status,
          toStatus: status as never,
          changedByName,
        },
      });
      if (awardPoints && order.memberId) {
        await tx.member.update({
          where: { id: order.memberId },
          data: { pointBalance: { increment: order.pointEarned } },
        });
      }
      if (isFirstPaid) {
        await this.stockService.decrementForOrder(id, tx);
      }
      return updatedOrder;
    });

    // Create commission when order is first marked as PAID
    if (isFirstPaid) {
      this.logger.log(`[Commission] triggering createForOrder for orderId=${id}`);
      try {
        const result = await this.commissionService.createForOrder(id);
        if (result) {
          this.logger.log(`[Commission] created id=${result.id} amount=${result.amount} earnerId=${result.earnerId}`);
        } else {
          this.logger.warn(`[Commission] skipped — order ${id} has no referrer`);
        }
      } catch (err) {
        this.logger.error(`[Commission] FAILED for order ${id}: ${String(err)}`);
      }
    }

    void this.auditLog.log({ adminEmail: changedByName, action: "order.status_change", entityType: "order", entityId: id, detail: JSON.stringify({ from: order.status, to: status }) });
    return { message: "Order status updated.", id: updated.id, status: updated.status };
  }

  async updateTracking(id: string, trackingNumber: string, changedByName = "Admin") {
    const order = await this.prisma.order.findUnique({ where: { id }, select: { id: true, status: true } });
    if (!order) throw new Error("Order not found");

    const shouldShip = trackingNumber.trim() !== "" && order.status !== "SHIPPED";

    await this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id },
        data: {
          trackingNumber,
          ...(shouldShip ? { status: "SHIPPED" as never } : {}),
        },
      });
      if (shouldShip) {
        await tx.orderStatusLog.create({
          data: {
            orderId: id,
            fromStatus: order.status,
            toStatus: "SHIPPED" as never,
            changedByName,
          },
        });
      }
    });

    return {
      message: "Tracking number updated.",
      id,
      trackingNumber,
      ...(shouldShip ? { status: "SHIPPED" } : {}),
    };
  }
}
