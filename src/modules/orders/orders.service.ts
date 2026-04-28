import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.order.findMany({
      include: {
        member: { select: { fullName: true, email: true, phone: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }

  async findOne(id: string) {
    return this.prisma.order.findUnique({
      where: { id },
      include: {
        member: { select: { fullName: true, email: true, phone: true } },
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

    const awardPoints =
      status === "DELIVERED" &&
      order.status !== "DELIVERED" &&
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
      return updatedOrder;
    });

    return { message: "Order status updated.", id: updated.id, status: updated.status };
  }
}
