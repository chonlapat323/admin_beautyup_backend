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
        items: { include: { product: { select: { name: true, sku: true } } } },
        statusLogs: { orderBy: { createdAt: "desc" } },
      },
    });
  }

  async updateStatus(id: string, status: string, changedByName: string) {
    const order = await this.prisma.order.findUnique({ where: { id }, select: { status: true } });
    if (!order) throw new Error("Order not found");

    const [updated] = await this.prisma.$transaction([
      this.prisma.order.update({
        where: { id },
        data: { status: status as never },
      }),
      this.prisma.orderStatusLog.create({
        data: {
          orderId: id,
          fromStatus: order.status,
          toStatus: status as never,
          changedByName,
        },
      }),
    ]);

    return { message: "Order status updated.", id: updated.id, status: updated.status };
  }
}
