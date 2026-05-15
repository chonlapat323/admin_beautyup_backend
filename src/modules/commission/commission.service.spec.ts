import { Test, TestingModule } from "@nestjs/testing";
import { CommissionService } from "./commission.service";
import { PrismaService } from "../prisma/prisma.service";
import { CommissionStatus } from "@prisma/client";

// ─── mock tx objects ───────────────────────────────────────────────────────

const mockTxCreate = {
  commission:        { create: jest.fn() },
  member:            { update: jest.fn() },
  creditTransaction: { create: jest.fn() },
};

const mockTxPayout = {
  commissionPayout: { create: jest.fn() },
  commission:       { updateMany: jest.fn() },
};

const mockTxReject = {
  withdrawalRequest: { update: jest.fn() },
  member:            { update: jest.fn() },
  creditTransaction: { create: jest.fn() },
};

// ─── mock prisma ──────────────────────────────────────────────────────────

const mockPrisma = {
  setting: {
    findMany: jest.fn(),
    upsert:   jest.fn(),
  },
  order: {
    findUnique: jest.fn(),
  },
  commission: {
    findMany:   jest.fn(),
    count:      jest.fn(),
    aggregate:  jest.fn(),
    update:     jest.fn(),
    updateMany: jest.fn(),
  },
  commissionPayout: {
    findMany: jest.fn(),
    count:    jest.fn(),
  },
  withdrawalRequest: {
    findMany:   jest.fn(),
    findUnique: jest.fn(),
    update:     jest.fn(),
  },
  member:            { update: jest.fn() },
  creditTransaction: { create: jest.fn() },
  $transaction: jest.fn(),
};

describe("CommissionService", () => {
  let service: CommissionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommissionService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<CommissionService>(CommissionService);
    jest.clearAllMocks();
  });

  // ─── getRates ─────────────────────────────────────────────────────────────

  describe("getRates", () => {
    it("ควร return rates จาก DB เมื่อพบ settings", async () => {
      // Arrange
      mockPrisma.setting.findMany.mockResolvedValue([
        { key: "commission.rate.SALON",   value: "15" },
        { key: "commission.rate.REGULAR", value: "8" },
      ]);

      // Act
      const result = await service.getRates();

      // Assert
      expect(result.salon).toBe(15);
      expect(result.regular).toBe(8);
    });

    it("ควร return default rates (SALON=10, REGULAR=5) เมื่อไม่พบ settings", async () => {
      // Arrange
      mockPrisma.setting.findMany.mockResolvedValue([]);

      // Act
      const result = await service.getRates();

      // Assert
      expect(result.salon).toBe(10);
      expect(result.regular).toBe(5);
    });
  });

  // ─── updateRates ──────────────────────────────────────────────────────────

  describe("updateRates", () => {
    it("ควร upsert ทั้ง SALON และ REGULAR rates และ return ค่าที่อัปเดต", async () => {
      // Arrange
      mockPrisma.setting.upsert.mockResolvedValue({});
      mockPrisma.$transaction.mockResolvedValue([]);

      // Act
      const result = await service.updateRates(12, 6);

      // Assert
      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(result).toEqual({ salon: 12, regular: 6 });
    });
  });

  // ─── createForOrder ───────────────────────────────────────────────────────

  describe("createForOrder", () => {
    it("ควร return null เมื่อไม่พบ order", async () => {
      // Arrange
      mockPrisma.order.findUnique.mockResolvedValue(null);

      // Act
      const result = await service.createForOrder("not-exist");

      // Assert
      expect(result).toBeNull();
    });

    it("ควร return null เมื่อ order ไม่มี referredBy", async () => {
      // Arrange
      mockPrisma.order.findUnique.mockResolvedValue({
        id: "o1", totalAmount: "500", orderNumber: "ORD-001",
        memberId: "m1",
        member: { referredBy: null },
      });

      // Act
      const result = await service.createForOrder("o1");

      // Assert
      expect(result).toBeNull();
    });

    it("ควรสร้าง commission ด้วย salon rate เมื่อ referrer เป็น SALON", async () => {
      // Arrange
      mockPrisma.order.findUnique.mockResolvedValue({
        id: "o1", totalAmount: "1000", orderNumber: "ORD-001",
        memberId: "m1",
        member: { referredBy: { id: "r1", memberType: "SALON" } },
      });
      mockPrisma.setting.findMany.mockResolvedValue([]); // default rates: SALON=10
      mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockTxCreate) => Promise<unknown>) => fn(mockTxCreate));
      mockTxCreate.commission.create.mockResolvedValue({ id: "c1", amount: 100 });
      mockTxCreate.member.update.mockResolvedValue({});
      mockTxCreate.creditTransaction.create.mockResolvedValue({});

      // Act
      const result = await service.createForOrder("o1");

      // Assert — 10% of 1000 = 100
      expect(mockTxCreate.commission.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ amount: 100, rate: 10 }) }),
      );
      expect(result?.id).toBe("c1");
    });

    it("ควรสร้าง commission ด้วย regular rate เมื่อ referrer เป็น REGULAR", async () => {
      // Arrange
      mockPrisma.order.findUnique.mockResolvedValue({
        id: "o1", totalAmount: "1000", orderNumber: "ORD-001",
        memberId: "m1",
        member: { referredBy: { id: "r1", memberType: "REGULAR" } },
      });
      mockPrisma.setting.findMany.mockResolvedValue([]); // default: REGULAR=5
      mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockTxCreate) => Promise<unknown>) => fn(mockTxCreate));
      mockTxCreate.commission.create.mockResolvedValue({ id: "c2", amount: 50 });
      mockTxCreate.member.update.mockResolvedValue({});
      mockTxCreate.creditTransaction.create.mockResolvedValue({});

      // Act
      await service.createForOrder("o1");

      // Assert — 5% of 1000 = 50
      expect(mockTxCreate.commission.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ amount: 50, rate: 5 }) }),
      );
    });

    it("ควร round commission amount ให้ 2 decimal places", async () => {
      // Arrange — 10% of 333 = 33.3 → rounded = 33.3
      mockPrisma.order.findUnique.mockResolvedValue({
        id: "o1", totalAmount: "333", orderNumber: "ORD-001",
        memberId: "m1",
        member: { referredBy: { id: "r1", memberType: "SALON" } },
      });
      mockPrisma.setting.findMany.mockResolvedValue([]);
      mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockTxCreate) => Promise<unknown>) => fn(mockTxCreate));
      mockTxCreate.commission.create.mockResolvedValue({ id: "c3", amount: 33.3 });
      mockTxCreate.member.update.mockResolvedValue({});
      mockTxCreate.creditTransaction.create.mockResolvedValue({});

      // Act
      await service.createForOrder("o1");

      // Assert
      const data = mockTxCreate.commission.create.mock.calls[0][0].data;
      expect(data.amount).toBe(33.3);
    });
  });

  // ─── findAll ──────────────────────────────────────────────────────────────

  describe("findAll", () => {
    it("ควร return items และ meta ที่ถูกต้อง", async () => {
      // Arrange
      mockPrisma.$transaction.mockResolvedValue([[{ id: "c1" }], 1]);

      // Act
      const result = await service.findAll({ page: 1, pageSize: 10 });

      // Assert
      expect(result.items).toHaveLength(1);
      expect(result.meta.totalItems).toBe(1);
    });

    it("ควรส่ง status filter เมื่อระบุ status", async () => {
      // Arrange
      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      // Act
      await service.findAll({ status: CommissionStatus.PENDING, page: 1, pageSize: 10 });

      // Assert
      const where = mockPrisma.commission.findMany.mock.calls[0][0].where;
      expect(where.status).toBe(CommissionStatus.PENDING);
    });

    it("ควรส่ง earnerId filter เมื่อระบุ earnerId", async () => {
      // Arrange
      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      // Act
      await service.findAll({ earnerId: "m1", page: 1, pageSize: 10 });

      // Assert
      const where = mockPrisma.commission.findMany.mock.calls[0][0].where;
      expect(where.earnerId).toBe("m1");
    });

    it("ควรส่ง createdAt filter เมื่อมี from และ to", async () => {
      // Arrange
      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      // Act
      await service.findAll({ from: "2026-01-01", to: "2026-01-31", page: 1, pageSize: 10 });

      // Assert
      const where = mockPrisma.commission.findMany.mock.calls[0][0].where;
      expect(where.createdAt.gte).toBeInstanceOf(Date);
      expect(where.createdAt.lte).toBeInstanceOf(Date);
    });
  });

  // ─── markPaid ─────────────────────────────────────────────────────────────

  describe("markPaid", () => {
    it("ควร return { count: 0, payout: null } เมื่อไม่มี PENDING commissions", async () => {
      // Arrange
      mockPrisma.commission.findMany.mockResolvedValue([]);

      // Act
      const result = await service.markPaid(["c1", "c2"]);

      // Assert
      expect(result.count).toBe(0);
      expect(result.payout).toBeNull();
    });

    it("ควรสร้าง payout และ update commissions เมื่อมี PENDING commissions", async () => {
      // Arrange
      mockPrisma.commission.findMany.mockResolvedValue([
        { id: "c1", earnerId: "m1", amount: "100" },
        { id: "c2", earnerId: "m1", amount: "200" },
      ]);
      mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockTxPayout) => Promise<unknown>) => fn(mockTxPayout));
      mockTxPayout.commissionPayout.create.mockResolvedValue({ id: "p1" });
      mockTxPayout.commission.updateMany.mockResolvedValue({});

      // Act
      const result = await service.markPaid(["c1", "c2"]);

      // Assert
      expect(result.count).toBe(2);
      expect(mockTxPayout.commissionPayout.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ memberId: "m1", totalAmount: 300 }) }),
      );
    });
  });

  // ─── findPayouts ──────────────────────────────────────────────────────────

  describe("findPayouts", () => {
    it("ควรส่ง memberId filter เมื่อระบุ", async () => {
      // Arrange
      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      // Act
      await service.findPayouts({ memberId: "m1", page: 1, pageSize: 10 });

      // Assert
      const where = mockPrisma.commissionPayout.findMany.mock.calls[0][0].where;
      expect(where.memberId).toBe("m1");
    });

    it("ควรไม่ส่ง filter เมื่อไม่ระบุ memberId", async () => {
      // Arrange
      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      // Act
      await service.findPayouts({ page: 1, pageSize: 10 });

      // Assert
      const where = mockPrisma.commissionPayout.findMany.mock.calls[0][0].where;
      expect(where).toEqual({});
    });
  });

  // ─── cancel ───────────────────────────────────────────────────────────────

  describe("cancel", () => {
    it("ควรอัปเดต status เป็น CANCELLED", async () => {
      // Arrange
      mockPrisma.commission.update.mockResolvedValue({ id: "c1", status: "CANCELLED" });

      // Act
      await service.cancel("c1");

      // Assert
      expect(mockPrisma.commission.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "c1" }, data: { status: CommissionStatus.CANCELLED } }),
      );
    });
  });

  // ─── listWithdrawals ──────────────────────────────────────────────────────

  describe("listWithdrawals", () => {
    it("ควรส่ง status filter เมื่อระบุ status", async () => {
      // Arrange
      mockPrisma.withdrawalRequest.findMany.mockResolvedValue([]);

      // Act
      await service.listWithdrawals("PENDING");

      // Assert
      const where = mockPrisma.withdrawalRequest.findMany.mock.calls[0][0].where;
      expect(where.status).toBe("PENDING");
    });

    it("ควรไม่ส่ง filter เมื่อ status='all'", async () => {
      // Arrange
      mockPrisma.withdrawalRequest.findMany.mockResolvedValue([]);

      // Act
      await service.listWithdrawals("all");

      // Assert
      const where = mockPrisma.withdrawalRequest.findMany.mock.calls[0][0].where;
      expect(where).toEqual({});
    });
  });

  // ─── approveWithdrawal ────────────────────────────────────────────────────

  describe("approveWithdrawal", () => {
    it("ควรอัปเดต status เป็น APPROVED", async () => {
      // Arrange
      mockPrisma.withdrawalRequest.findUnique.mockResolvedValue({ id: "w1", status: "PENDING", memberId: "m1" });
      mockPrisma.withdrawalRequest.update.mockResolvedValue({ id: "w1", status: "APPROVED" });

      // Act
      await service.approveWithdrawal("w1", "admin@test.com");

      // Assert
      expect(mockPrisma.withdrawalRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: "APPROVED" }) }),
      );
    });

    it("ควร throw เมื่อไม่พบ หรือ status ไม่ใช่ PENDING", async () => {
      // Arrange
      mockPrisma.withdrawalRequest.findUnique.mockResolvedValue(null);

      // Assert
      await expect(service.approveWithdrawal("not-exist")).rejects.toThrow();
    });

    it("ควร throw เมื่อ status ไม่ใช่ PENDING", async () => {
      // Arrange
      mockPrisma.withdrawalRequest.findUnique.mockResolvedValue({ id: "w1", status: "APPROVED" });

      // Assert
      await expect(service.approveWithdrawal("w1")).rejects.toThrow();
    });
  });

  // ─── rejectWithdrawal ─────────────────────────────────────────────────────

  describe("rejectWithdrawal", () => {
    it("ควรอัปเดต status เป็น REJECTED และคืน credit ให้ member", async () => {
      // Arrange
      mockPrisma.withdrawalRequest.findUnique.mockResolvedValue({
        id: "w1", status: "PENDING", memberId: "m1", amount: "500",
      });
      mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockTxReject) => Promise<unknown>) => fn(mockTxReject));
      mockTxReject.withdrawalRequest.update.mockResolvedValue({ id: "w1", status: "REJECTED" });
      mockTxReject.member.update.mockResolvedValue({});
      mockTxReject.creditTransaction.create.mockResolvedValue({});

      // Act
      await service.rejectWithdrawal("w1", "ข้อมูลไม่ถูกต้อง");

      // Assert
      expect(mockTxReject.withdrawalRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: "REJECTED" }) }),
      );
      expect(mockTxReject.member.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { creditBalance: { increment: 500 } } }),
      );
    });

    it("ควร throw เมื่อไม่พบ หรือ status ไม่ใช่ PENDING", async () => {
      // Arrange
      mockPrisma.withdrawalRequest.findUnique.mockResolvedValue(null);

      // Assert
      await expect(service.rejectWithdrawal("not-exist")).rejects.toThrow();
    });
  });

  // ─── report ───────────────────────────────────────────────────────────────

  describe("report", () => {
    const baseRow = {
      id: "c1",
      earnerId: "e1",
      amount: "100",
      createdAt: new Date("2026-01-15T12:00:00Z"),
      earner: { id: "e1", fullName: "Alice", memberType: "SALON", referralCode: "ALI" },
    };

    it("ควรจัด bucket ตามวัน (YYYY-MM-DD) เมื่อ period=day", async () => {
      // Arrange
      mockPrisma.commission.findMany.mockResolvedValue([baseRow]);

      // Act
      const result = await service.report("day");

      // Assert
      expect(result[0].bucket).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("ควรจัด bucket ตามเดือน (YYYY-MM) เมื่อ period=month", async () => {
      // Arrange
      mockPrisma.commission.findMany.mockResolvedValue([baseRow]);

      // Act
      const result = await service.report("month");

      // Assert
      expect(result[0].bucket).toMatch(/^\d{4}-\d{2}$/);
    });

    it("ควรรวม count และ totalAmount เมื่อ earner เดียวกันอยู่ใน bucket เดียวกัน", async () => {
      // Arrange — earner เดียวกัน 2 rows ใน bucket เดียวกัน
      mockPrisma.commission.findMany.mockResolvedValue([
        { ...baseRow, id: "c1", amount: "100", createdAt: new Date("2026-01-15") },
        { ...baseRow, id: "c2", amount: "200", createdAt: new Date("2026-01-15") },
      ]);

      // Act
      const result = await service.report("day");

      // Assert
      expect(result).toHaveLength(1); // รวมเป็น 1 bucket
      expect(result[0].count).toBe(2);
      expect(result[0].totalAmount).toBe(300);
    });

    it("ควร return [] เมื่อไม่มี commissions", async () => {
      // Arrange
      mockPrisma.commission.findMany.mockResolvedValue([]);

      // Act
      const result = await service.report("day");

      // Assert
      expect(result).toEqual([]);
    });
  });

  // ─── summary ──────────────────────────────────────────────────────────────

  describe("summary", () => {
    it("ควร return pending และ paid amounts ของ earner", async () => {
      // Arrange
      mockPrisma.commission.aggregate
        .mockResolvedValueOnce({ _sum: { amount: "150" }, _count: 3 })  // pending
        .mockResolvedValueOnce({ _sum: { amount: "500" }, _count: 10 }); // paid

      // Act
      const result = await service.summary("m1");

      // Assert
      expect(result.pendingAmount).toBe(150);
      expect(result.pendingCount).toBe(3);
      expect(result.paidAmount).toBe(500);
      expect(result.paidCount).toBe(10);
    });

    it("ควร return 0 เมื่อไม่มี commission", async () => {
      // Arrange
      mockPrisma.commission.aggregate
        .mockResolvedValueOnce({ _sum: { amount: null }, _count: 0 })
        .mockResolvedValueOnce({ _sum: { amount: null }, _count: 0 });

      // Act
      const result = await service.summary("m1");

      // Assert
      expect(result.pendingAmount).toBe(0);
      expect(result.paidAmount).toBe(0);
    });
  });
});
