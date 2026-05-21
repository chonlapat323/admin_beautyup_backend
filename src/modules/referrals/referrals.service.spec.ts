import { Test, TestingModule } from "@nestjs/testing";
import { ReferralsService } from "./referrals.service";
import { PrismaService } from "../prisma/prisma.service";
import { CommissionStatus } from "@prisma/client";

// ─── mock prisma ──────────────────────────────────────────────────────────────

const mockPrisma = {
  member: {
    count: jest.fn(),
    findMany: jest.fn(),
  },
  commission: {
    aggregate: jest.fn(),
  },
};

describe("ReferralsService", () => {
  let service: ReferralsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReferralsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ReferralsService>(ReferralsService);
    jest.clearAllMocks();
  });

  // ─── summary ─────────────────────────────────────────────────────────────────

  describe("summary", () => {
    it("ควร return ยอดรวม totalReferrals, pendingCommission และ paidCommission ที่ถูกต้อง", async () => {
      // Arrange
      mockPrisma.member.count.mockResolvedValue(5);
      mockPrisma.commission.aggregate
        .mockResolvedValueOnce({ _sum: { amount: "1500" }, _count: 3 }) // PENDING
        .mockResolvedValueOnce({ _sum: { amount: "4000" }, _count: 8 }); // PAID

      // Act
      const result = await service.summary();

      // Assert
      expect(result.totalReferrals).toBe(5);
      expect(result.pendingCommission).toBe(1500);
      expect(result.pendingCount).toBe(3);
      expect(result.paidCommission).toBe(4000);
      expect(result.paidCount).toBe(8);
    });

    it("กรณีไม่มี referral — ควร return 0 ไม่ใช่ null เมื่อ amount = null", async () => {
      // Arrange
      mockPrisma.member.count.mockResolvedValue(0);
      mockPrisma.commission.aggregate
        .mockResolvedValueOnce({ _sum: { amount: null }, _count: 0 }) // PENDING
        .mockResolvedValueOnce({ _sum: { amount: null }, _count: 0 }); // PAID

      // Act
      const result = await service.summary();

      // Assert
      expect(result.totalReferrals).toBe(0);
      expect(result.pendingCommission).toBe(0);
      expect(result.pendingCount).toBe(0);
      expect(result.paidCommission).toBe(0);
      expect(result.paidCount).toBe(0);
    });

    it("กรณีมี pending แต่ไม่มี paid — ควร return paidCommission = 0", async () => {
      // Arrange
      mockPrisma.member.count.mockResolvedValue(2);
      mockPrisma.commission.aggregate
        .mockResolvedValueOnce({ _sum: { amount: "800" }, _count: 2 }) // PENDING
        .mockResolvedValueOnce({ _sum: { amount: null }, _count: 0 }); // PAID

      // Act
      const result = await service.summary();

      // Assert
      expect(result.pendingCommission).toBe(800);
      expect(result.pendingCount).toBe(2);
      expect(result.paidCommission).toBe(0);
      expect(result.paidCount).toBe(0);
    });

    it("ควร call prisma.member.count ด้วย filter referredById not null", async () => {
      // Arrange
      mockPrisma.member.count.mockResolvedValue(0);
      mockPrisma.commission.aggregate
        .mockResolvedValueOnce({ _sum: { amount: null }, _count: 0 })
        .mockResolvedValueOnce({ _sum: { amount: null }, _count: 0 });

      // Act
      await service.summary();

      // Assert
      expect(mockPrisma.member.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { referredById: { not: null } },
        }),
      );
    });

    it("ควร call prisma.commission.aggregate แยกสำหรับ PENDING และ PAID", async () => {
      // Arrange
      mockPrisma.member.count.mockResolvedValue(1);
      mockPrisma.commission.aggregate
        .mockResolvedValueOnce({ _sum: { amount: "100" }, _count: 1 })
        .mockResolvedValueOnce({ _sum: { amount: "200" }, _count: 2 });

      // Act
      await service.summary();

      // Assert
      expect(mockPrisma.commission.aggregate).toHaveBeenCalledTimes(2);
      expect(mockPrisma.commission.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: CommissionStatus.PENDING } }),
      );
      expect(mockPrisma.commission.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: CommissionStatus.PAID } }),
      );
    });
  });

  // ─── history ──────────────────────────────────────────────────────────────────

  describe("history", () => {
    it("ควร return ข้อมูลครบถ้วน: referredMemberId, referredMemberName, referrerId, referralCode, totalCommission, pendingCommission", async () => {
      // Arrange
      mockPrisma.member.findMany.mockResolvedValue([
        {
          id: "m1",
          fullName: "สมใจ ดีมาก",
          memberType: "REGULAR",
          createdAt: new Date("2026-03-01"),
          referredBy: { id: "r1", fullName: "นางสาวตัวอย่าง", referralCode: "REF001" },
          orders: [
            {
              commissions: [
                { amount: "300", status: CommissionStatus.PAID },
                { amount: "200", status: CommissionStatus.PENDING },
              ],
            },
          ],
        },
      ]);

      // Act
      const result = await service.history();

      // Assert
      expect(result).toHaveLength(1);
      const row = result[0];
      expect(row.referredMemberId).toBe("m1");
      expect(row.referredMemberName).toBe("สมใจ ดีมาก");
      expect(row.referredMemberType).toBe("REGULAR");
      expect(row.joinedAt).toEqual(new Date("2026-03-01"));
      expect(row.referrerId).toBe("r1");
      expect(row.referrerName).toBe("นางสาวตัวอย่าง");
      expect(row.referralCode).toBe("REF001");
      expect(row.totalCommission).toBe(500);
      expect(row.pendingCommission).toBe(200);
    });

    it("ควรคำนวณ totalCommission ถูกต้อง — รวมทุก commission ของทุก order", async () => {
      // Arrange — 2 orders, แต่ละ order มี commissions หลายตัว
      mockPrisma.member.findMany.mockResolvedValue([
        {
          id: "m2",
          fullName: "ทดสอบ สองออเดอร์",
          memberType: "SALON",
          createdAt: new Date("2026-04-01"),
          referredBy: { id: "r2", fullName: "ผู้แนะนำ", referralCode: "REF002" },
          orders: [
            {
              commissions: [
                { amount: "100", status: CommissionStatus.PAID },
                { amount: "50",  status: CommissionStatus.PAID },
              ],
            },
            {
              commissions: [
                { amount: "200", status: CommissionStatus.PENDING },
                { amount: "75",  status: CommissionStatus.PAID },
              ],
            },
          ],
        },
      ]);

      // Act
      const result = await service.history();

      // Assert — 100 + 50 + 200 + 75 = 425
      expect(result[0].totalCommission).toBe(425);
    });

    it("ควรคำนวณ pendingCommission ถูกต้อง — เฉพาะ status = PENDING", async () => {
      // Arrange
      mockPrisma.member.findMany.mockResolvedValue([
        {
          id: "m3",
          fullName: "ทดสอบ pending",
          memberType: "REGULAR",
          createdAt: new Date("2026-04-15"),
          referredBy: { id: "r3", fullName: "ผู้แนะนำสาม", referralCode: "REF003" },
          orders: [
            {
              commissions: [
                { amount: "500", status: CommissionStatus.PAID },
                { amount: "150", status: CommissionStatus.PENDING },
                { amount: "250", status: CommissionStatus.PENDING },
              ],
            },
          ],
        },
      ]);

      // Act
      const result = await service.history();

      // Assert — pending: 150 + 250 = 400
      expect(result[0].pendingCommission).toBe(400);
    });

    it("เมื่อ member มี orders หลาย orders และแต่ละ order มี commissions หลายตัว — ควร sum ได้ถูกต้อง", async () => {
      // Arrange
      mockPrisma.member.findMany.mockResolvedValue([
        {
          id: "m4",
          fullName: "ซับซ้อน หลายออเดอร์",
          memberType: "SALON",
          createdAt: new Date("2026-05-01"),
          referredBy: { id: "r4", fullName: "ผู้แนะนำสี่", referralCode: "REF004" },
          orders: [
            { commissions: [{ amount: "100", status: CommissionStatus.PENDING }] },
            { commissions: [{ amount: "200", status: CommissionStatus.PENDING }] },
            { commissions: [{ amount: "300", status: CommissionStatus.PAID }] },
          ],
        },
      ]);

      // Act
      const result = await service.history();

      // Assert
      expect(result[0].totalCommission).toBe(600);   // 100+200+300
      expect(result[0].pendingCommission).toBe(300);  // 100+200
    });

    it("กรณี member ไม่มี orders — ควร return totalCommission = 0 และ pendingCommission = 0", async () => {
      // Arrange
      mockPrisma.member.findMany.mockResolvedValue([
        {
          id: "m5",
          fullName: "ไม่มีออเดอร์",
          memberType: "REGULAR",
          createdAt: new Date("2026-05-10"),
          referredBy: { id: "r5", fullName: "ผู้แนะนำห้า", referralCode: "REF005" },
          orders: [],
        },
      ]);

      // Act
      const result = await service.history();

      // Assert
      expect(result[0].totalCommission).toBe(0);
      expect(result[0].pendingCommission).toBe(0);
    });

    it("กรณีไม่มี members — ควร return []", async () => {
      // Arrange
      mockPrisma.member.findMany.mockResolvedValue([]);

      // Act
      const result = await service.history();

      // Assert
      expect(result).toEqual([]);
    });

    it("ควร query ด้วย orderBy: createdAt desc และ take: 100", async () => {
      // Arrange
      mockPrisma.member.findMany.mockResolvedValue([]);

      // Act
      await service.history();

      // Assert
      expect(mockPrisma.member.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: "desc" },
          take: 100,
        }),
      );
    });
  });
});
