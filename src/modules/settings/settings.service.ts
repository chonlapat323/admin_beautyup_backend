import { Injectable } from "@nestjs/common";

@Injectable()
export class SettingsService {
  getAll() {
    return {
      shipping: { freeShippingThreshold: 1000, defaultShippingFee: 50 },
      points: { threshold: 3000, earnedPoint: 300 },
      referral: { commissionRate: 0.03 },
      stock: { reservePercentage: 10 },
    };
  }

  update(payload: unknown) {
    return {
      message: "Settings updated.",
      payload,
    };
  }
}
