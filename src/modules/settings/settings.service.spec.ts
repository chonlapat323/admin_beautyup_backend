import { Test, TestingModule } from "@nestjs/testing";
import { SettingsService, PointTier } from "./settings.service";
import { PrismaService } from "../prisma/prisma.service";

const mockPrisma = {
  setting: {
    findMany:  jest.fn(),
    findUnique: jest.fn(),
    upsert:    jest.fn(),
  },
};

describe("SettingsService", () => {
  let service: SettingsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettingsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<SettingsService>(SettingsService);
    jest.clearAllMocks();
  });

  // ─── getAll ────────────────────────────────────────────────────────────────

  describe("getAll", () => {
    it("ควร return ค่าจาก DB เมื่อพบ settings", async () => {
      // Arrange
      mockPrisma.setting.findMany.mockResolvedValue([
        { key: "free_shipping_threshold", value: "800" },
        { key: "default_shipping_fee",    value: "30" },
        { key: "gateway_fee",             value: "25" },
        { key: "stock_reserve_percentage", value: "15" },
      ]);

      // Act
      const result = await service.getAll();

      // Assert
      expect(result.shipping.freeShippingThreshold).toBe(800);
      expect(result.shipping.defaultShippingFee).toBe(30);
      expect(result.payment.gatewayFee).toBe(25);
      expect(result.stock.reservePercentage).toBe(15);
    });

    it("ควร return default values เมื่อไม่พบ settings ใน DB", async () => {
      // Arrange
      mockPrisma.setting.findMany.mockResolvedValue([]);

      // Act
      const result = await service.getAll();

      // Assert
      expect(result.shipping.freeShippingThreshold).toBe(1000);
      expect(result.shipping.defaultShippingFee).toBe(50);
      expect(result.payment.gatewayFee).toBe(20);
      expect(result.stock.reservePercentage).toBe(10);
    });

    it("ควร parse point_tiers จาก JSON เมื่อพบใน DB", async () => {
      // Arrange
      const tiers: PointTier[] = [{ minSpend: 1000, points: 100 }];
      mockPrisma.setting.findMany.mockResolvedValue([
        { key: "point_tiers", value: JSON.stringify(tiers) },
      ]);

      // Act
      const result = await service.getAll();

      // Assert
      expect(result.points.tiers).toEqual(tiers);
    });

    it("ควร return POINT_TIERS_DEFAULT เมื่อไม่มี point_tiers ใน DB", async () => {
      // Arrange
      mockPrisma.setting.findMany.mockResolvedValue([]);

      // Act
      const result = await service.getAll();

      // Assert
      expect(result.points.tiers.length).toBeGreaterThan(0);
      expect(result.points.tiers[0]).toHaveProperty("minSpend");
      expect(result.points.tiers[0]).toHaveProperty("points");
    });

    it("ควร return social URLs จาก DB", async () => {
      // Arrange
      mockPrisma.setting.findMany.mockResolvedValue([
        { key: "youtube_url", value: "https://youtube.com/@beautyup" },
        { key: "tiktok_url",  value: "https://tiktok.com/@beautyup" },
      ]);

      // Act
      const result = await service.getAll();

      // Assert
      expect(result.social.youtubeUrl).toBe("https://youtube.com/@beautyup");
      expect(result.social.tiktokUrl).toBe("https://tiktok.com/@beautyup");
    });

    it("ควร return empty string สำหรับ social URLs เมื่อไม่พบ", async () => {
      // Arrange
      mockPrisma.setting.findMany.mockResolvedValue([]);

      // Act
      const result = await service.getAll();

      // Assert
      expect(result.social.youtubeUrl).toBe("");
      expect(result.social.tiktokUrl).toBe("");
    });
  });

  // ─── getValue ──────────────────────────────────────────────────────────────

  describe("getValue", () => {
    it("ควร return ค่าจาก DB เมื่อพบ", async () => {
      // Arrange
      mockPrisma.setting.findUnique.mockResolvedValue({ key: "gateway_fee", value: "35" });

      // Act
      const result = await service.getValue("gateway_fee");

      // Assert
      expect(result).toBe(35);
    });

    it("ควร return default เมื่อไม่พบ", async () => {
      // Arrange
      mockPrisma.setting.findUnique.mockResolvedValue(null);

      // Act
      const result = await service.getValue("gateway_fee");

      // Assert
      expect(result).toBe(20); // DEFAULTS.gateway_fee
    });
  });

  // ─── getPointTiers ─────────────────────────────────────────────────────────

  describe("getPointTiers", () => {
    it("ควร parse JSON จาก DB เมื่อพบ", async () => {
      // Arrange
      const tiers: PointTier[] = [{ minSpend: 2000, points: 200 }];
      mockPrisma.setting.findUnique.mockResolvedValue({ key: "point_tiers", value: JSON.stringify(tiers) });

      // Act
      const result = await service.getPointTiers();

      // Assert
      expect(result).toEqual(tiers);
    });

    it("ควร return POINT_TIERS_DEFAULT เมื่อไม่พบ", async () => {
      // Arrange
      mockPrisma.setting.findUnique.mockResolvedValue(null);

      // Act
      const result = await service.getPointTiers();

      // Assert
      expect(result.length).toBeGreaterThan(0);
    });
  });

  // ─── calculatePoints (static) ──────────────────────────────────────────────

  describe("calculatePoints", () => {
    const tiers: PointTier[] = [
      { minSpend: 3000, points: 300 },
      { minSpend: 5000, points: 500 },
      { minSpend: 10000, points: 1000 },
    ];

    it("ควร return points ของ tier สูงสุดที่ subtotal ถึง", () => {
      expect(SettingsService.calculatePoints(10000, tiers)).toBe(1000);
    });

    it("ควร return points ของ tier กลางที่ subtotal ถึง", () => {
      expect(SettingsService.calculatePoints(5000, tiers)).toBe(500);
    });

    it("ควร return 0 เมื่อ subtotal ต่ำกว่า tier ต่ำสุด", () => {
      expect(SettingsService.calculatePoints(2999, tiers)).toBe(0);
    });

    it("subtotal boundary: 3000 ควรได้ 300 (>= minSpend)", () => {
      expect(SettingsService.calculatePoints(3000, tiers)).toBe(300);
    });
  });

  // ─── update ────────────────────────────────────────────────────────────────

  describe("update", () => {
    it("ควร upsert เฉพาะ fields ที่ส่งมา ไม่ใช่ทุก field", async () => {
      // Arrange
      mockPrisma.setting.upsert.mockResolvedValue({});
      mockPrisma.setting.findMany.mockResolvedValue([]);

      // Act
      await service.update({ freeShippingThreshold: 1200 });

      // Assert — upsert ถูกเรียกแค่ครั้งเดียว (1 field)
      expect(mockPrisma.setting.upsert).toHaveBeenCalledTimes(1);
      expect(mockPrisma.setting.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { key: "free_shipping_threshold" } }),
      );
    });

    it("ควร upsert หลาย fields พร้อมกันเมื่อส่งหลาย field", async () => {
      // Arrange
      mockPrisma.setting.upsert.mockResolvedValue({});
      mockPrisma.setting.findMany.mockResolvedValue([]);

      // Act
      await service.update({ freeShippingThreshold: 1200, defaultShippingFee: 60, gatewayFee: 30 });

      // Assert
      expect(mockPrisma.setting.upsert).toHaveBeenCalledTimes(3);
    });

    it("ควร serialize pointTiers เป็น JSON string เมื่ออัปเดต", async () => {
      // Arrange
      const tiers: PointTier[] = [{ minSpend: 2000, points: 200 }];
      mockPrisma.setting.upsert.mockResolvedValue({});
      mockPrisma.setting.findMany.mockResolvedValue([]);

      // Act
      await service.update({ pointTiers: tiers });

      // Assert
      const call = mockPrisma.setting.upsert.mock.calls[0][0];
      expect(call.create.value).toBe(JSON.stringify(tiers));
    });
  });
});
