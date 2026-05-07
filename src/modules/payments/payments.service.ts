import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const orders = await this.prisma.order.findMany({
      where: {
        status: { not: "CANCELLED" },
        paymentMethod: { not: null },
      },
      select: { paymentMethod: true, totalAmount: true },
    });

    return orders.map((o) => ({
      method: o.paymentMethod!,
      status: "PAID",
      amount: Number(o.totalAmount),
    }));
  }

  retry(orderId: string) {
    return { message: "Payment retry requested.", orderId };
  }
}
