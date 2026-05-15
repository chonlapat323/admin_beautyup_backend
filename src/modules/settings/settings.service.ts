import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

const DEFAULTS = {
  free_shipping_threshold: 1000,
  default_shipping_fee: 50,
  stock_reserve_percentage: 10,
  gateway_fee: 20,
} as const;

type SettingKey = keyof typeof DEFAULTS;

const STRING_DEFAULTS: Record<string, string> = {
  youtube_url: "",
  tiktok_url: "",
};

export type PointTier = { minSpend: number; points: number };

const POINT_TIERS_DEFAULT: PointTier[] = [
  { minSpend: 3000, points: 300 },
  { minSpend: 5000, points: 500 },
  { minSpend: 10000, points: 1000 },
];

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAll() {
    const rows = await this.prisma.setting.findMany();
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));

    const num = (key: SettingKey) => parseFloat(map[key] ?? "") || DEFAULTS[key];

    const str = (key: string) => map[key] ?? STRING_DEFAULTS[key] ?? "";

    return {
      shipping: {
        freeShippingThreshold: num("free_shipping_threshold"),
        defaultShippingFee: num("default_shipping_fee"),
      },
      points: {
        tiers: this.parsePointTiers(map["point_tiers"]),
      },
      stock: { reservePercentage: num("stock_reserve_percentage") },
      payment: { gatewayFee: num("gateway_fee") },
      social: {
        youtubeUrl: str("youtube_url"),
        tiktokUrl: str("tiktok_url"),
      },
    };
  }

  async getValue(key: SettingKey): Promise<number> {
    const row = await this.prisma.setting.findUnique({ where: { key } });
    return parseFloat(row?.value ?? "") || DEFAULTS[key];
  }

  async getPointTiers(): Promise<PointTier[]> {
    const row = await this.prisma.setting.findUnique({ where: { key: "point_tiers" } });
    return this.parsePointTiers(row?.value);
  }

  static calculatePoints(subtotal: number, tiers: PointTier[]): number {
    const sorted = [...tiers].sort((a, b) => b.minSpend - a.minSpend);
    return sorted.find((t) => subtotal >= t.minSpend)?.points ?? 0;
  }

  async update(payload: {
    freeShippingThreshold?: number;
    defaultShippingFee?: number;
    gatewayFee?: number;
    pointTiers?: PointTier[];
    youtubeUrl?: string;
    tiktokUrl?: string;
  }) {
    const pairs: [string, string | undefined][] = [
      ["free_shipping_threshold", payload.freeShippingThreshold !== undefined ? String(payload.freeShippingThreshold) : undefined],
      ["default_shipping_fee", payload.defaultShippingFee !== undefined ? String(payload.defaultShippingFee) : undefined],
      ["gateway_fee", payload.gatewayFee !== undefined ? String(payload.gatewayFee) : undefined],
      ["point_tiers", payload.pointTiers !== undefined ? JSON.stringify(payload.pointTiers) : undefined],
      ["youtube_url", payload.youtubeUrl !== undefined ? payload.youtubeUrl : undefined],
      ["tiktok_url", payload.tiktokUrl !== undefined ? payload.tiktokUrl : undefined],
    ];

    await Promise.all(
      pairs
        .filter(([, v]) => v !== undefined)
        .map(([key, v]) =>
          this.prisma.setting.upsert({
            where: { key },
            create: { key, value: v! },
            update: { value: v! },
          }),
        ),
    );

    return this.getAll();
  }

  private parsePointTiers(raw: string | undefined | null): PointTier[] {
    try {
      if (raw) return JSON.parse(raw) as PointTier[];
    } catch { /* fall through */ }
    return POINT_TIERS_DEFAULT;
  }
}
