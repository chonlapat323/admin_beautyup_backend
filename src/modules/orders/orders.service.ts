import { Injectable } from "@nestjs/common";

@Injectable()
export class OrdersService {
  findAll() {
    return [
      { id: "ord_001", orderNumber: "BU-24003", status: "PAID", totalAmount: 69 },
      { id: "ord_002", orderNumber: "BU-24031", status: "PROCESSING", totalAmount: 120 },
    ];
  }

  findOne(id: string) {
    return {
      id,
      orderNumber: "BU-24003",
      status: "PAID",
      subtotalAmount: 49,
      shippingAmount: 20,
      totalAmount: 69,
    };
  }

  updateStatus(id: string, status: string) {
    return { message: "Order status updated.", id, status };
  }
}
