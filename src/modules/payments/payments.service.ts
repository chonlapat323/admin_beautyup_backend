import { Injectable } from "@nestjs/common";

@Injectable()
export class PaymentsService {
  findAll() {
    return [
      { orderNumber: "BU-24003", method: "PROMPTPAY_QR", status: "SUCCESS", amount: 69 },
      { orderNumber: "BU-24031", method: "CARD", status: "PAID", amount: 120 },
    ];
  }

  retry(orderId: string) {
    return { message: "Payment retry requested.", orderId };
  }
}
