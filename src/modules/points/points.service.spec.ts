import { Test, TestingModule } from "@nestjs/testing";
import { PointsService } from "./points.service";

describe("PointsService", () => {
  let service: PointsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PointsService],
    }).compile();

    service = module.get<PointsService>(PointsService);
  });

  // ─── rules ───────────────────────────────────────────────────────────────────

  describe("rules", () => {
    it("ควร return spendingThreshold = 3000", () => {
      // Act
      const result = service.rules();

      // Assert
      expect(result.spendingThreshold).toBe(3000);
    });

    it("ควร return earnedPoint = 300", () => {
      // Act
      const result = service.rules();

      // Assert
      expect(result.earnedPoint).toBe(300);
    });

    it("ควร return formula string ถูกต้อง", () => {
      // Act
      const result = service.rules();

      // Assert
      expect(result.formula).toBe("floor(net_paid / 3000) * 300");
    });

    it("ตรวจสอบ logic formula — ซื้อ 3000 บาท ได้ 300 pts", () => {
      // Arrange
      const { spendingThreshold, earnedPoint } = service.rules();

      // Act — floor(3000 / 3000) * 300 = 300
      const netPaid = 3000;
      const pts = Math.floor(netPaid / spendingThreshold) * earnedPoint;

      // Assert
      expect(pts).toBe(300);
    });

    it("ตรวจสอบ logic formula — ซื้อ 6000 บาท ได้ 600 pts", () => {
      // Arrange
      const { spendingThreshold, earnedPoint } = service.rules();

      // Act — floor(6000 / 3000) * 300 = 600
      const netPaid = 6000;
      const pts = Math.floor(netPaid / spendingThreshold) * earnedPoint;

      // Assert
      expect(pts).toBe(600);
    });

    it("ตรวจสอบ logic formula — ซื้อ 2999 บาท ได้ 0 pts (ไม่ถึง threshold)", () => {
      // Arrange
      const { spendingThreshold, earnedPoint } = service.rules();

      // Act — floor(2999 / 3000) * 300 = 0
      const netPaid = 2999;
      const pts = Math.floor(netPaid / spendingThreshold) * earnedPoint;

      // Assert
      expect(pts).toBe(0);
    });
  });

  // ─── history ──────────────────────────────────────────────────────────────────

  describe("history", () => {
    it("ควร return memberId ที่ส่งเข้าไปใน result", () => {
      // Arrange
      const memberId = "member-abc-123";

      // Act
      const result = service.history(memberId);

      // Assert
      expect(result.memberId).toBe(memberId);
    });

    it("ควร return transactions array ที่มีทั้ง EARN และ REDEEM", () => {
      // Act
      const result = service.history("m1");

      // Assert
      const types = result.transactions.map((t) => t.type);
      expect(types).toContain("EARN");
      expect(types).toContain("REDEEM");
    });

    it("ควรมี EARN transaction ที่มี points > 0", () => {
      // Act
      const result = service.history("m1");

      // Assert
      const earnTx = result.transactions.find((t) => t.type === "EARN");
      expect(earnTx).toBeDefined();
      expect(earnTx!.points).toBeGreaterThan(0);
    });

    it("ควรมี REDEEM transaction ที่มี points < 0", () => {
      // Act
      const result = service.history("m1");

      // Assert
      const redeemTx = result.transactions.find((t) => t.type === "REDEEM");
      expect(redeemTx).toBeDefined();
      expect(redeemTx!.points).toBeLessThan(0);
    });

    it("เมื่อส่ง memberId ต่างกัน — memberId ใน result ต้องตรงกับที่ส่งเข้า", () => {
      // Arrange
      const memberIdA = "member-AAA";
      const memberIdB = "member-BBB";

      // Act
      const resultA = service.history(memberIdA);
      const resultB = service.history(memberIdB);

      // Assert
      expect(resultA.memberId).toBe(memberIdA);
      expect(resultB.memberId).toBe(memberIdB);
      expect(resultA.memberId).not.toBe(resultB.memberId);
    });

    it("ควรมี transactions อย่างน้อย 1 EARN และ 1 REDEEM", () => {
      // Act
      const result = service.history("m1");

      // Assert
      const earnCount  = result.transactions.filter((t) => t.type === "EARN").length;
      const redeemCount = result.transactions.filter((t) => t.type === "REDEEM").length;
      expect(earnCount).toBeGreaterThanOrEqual(1);
      expect(redeemCount).toBeGreaterThanOrEqual(1);
    });
  });
});
