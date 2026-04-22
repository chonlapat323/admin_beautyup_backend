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
      },
    });
  }

  async updateStatus(id: string, status: string) {
    const updated = await this.prisma.order.update({
      where: { id },
      data: { status: status as never },
    });
    return { message: "Order status updated.", id: updated.id, status: updated.status };
  }
}
