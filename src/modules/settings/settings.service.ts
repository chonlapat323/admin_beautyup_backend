import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

const DEFAULTS = {
  free_shipping_threshold: 1000,
  default_shipping_fee: 50,
  point_threshold: 3000,
  earned_point: 300,
  referral_commission_rate: 0.03,
  stock_reserve_percentage: 10,
  gateway_fee: 20,
} as const;

type SettingKey = keyof typeof DEFAULTS;

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAll() {
    const rows = await this.prisma.setting.findMany();
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));

    const num = (key: SettingKey) => parseFloat(map[key] ?? "") || DEFAULTS[key];

    return {
      shipping: {
        freeShippingThreshold: num("free_shipping_threshold"),
        defaultShippingFee: num("default_shipping_fee"),
      },
      points: {
        threshold: num("point_threshold"),
        earnedPoint: num("earned_point"),
      },
      referral: { commissionRate: num("referral_commission_rate") },
      stock: { reservePercentage: num("stock_reserve_percentage") },
      payment: { gatewayFee: num("gateway_fee") },
    };
  }

  async getValue(key: SettingKey): Promise<number> {
    const row = await this.prisma.setting.findUnique({ where: { key } });
    return parseFloat(row?.value ?? "") || DEFAULTS[key];
  }

  async update(payload: {
    freeShippingThreshold?: number;
    defaultShippingFee?: number;
    pointThreshold?: number;
    earnedPoint?: number;
    gatewayFee?: number;
  }) {
    const pairs: [SettingKey, number | undefined][] = [
      ["free_shipping_threshold", payload.freeShippingThreshold],
      ["default_shipping_fee", payload.defaultShippingFee],
      ["point_threshold", payload.pointThreshold],
      ["earned_point", payload.earnedPoint],
      ["gateway_fee", payload.gatewayFee],
    ];

    await Promise.all(
      pairs
        .filter(([, v]) => v !== undefined)
        .map(([key, v]) =>
          this.prisma.setting.upsert({
            where: { key },
            create: { key, value: String(v) },
            update: { value: String(v) },
          }),
        ),
    );

    return this.getAll();
  }
}
