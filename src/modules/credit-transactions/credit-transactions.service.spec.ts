import { Test, TestingModule } from "@nestjs/testing";
import { CreditTransactionsService } from "./credit-transactions.service";
import { PrismaService } from "../prisma/prisma.service";

const mockTx = {
  id: "ct1",
  memberId: "m1",
  type: "EARN",
  amount: "100",
  createdAt: new Date("2026-01-15"),
  member: { id: "m1", fullName: "Alice", email: "alice@test.com" },
};

const mockPrisma = {
  creditTransaction: {
    findMany: jest.fn(),
    count:    jest.fn(),
  },
  $transaction: jest.fn(),
};

describe("CreditTransactionsService", () => {
  let service: CreditTransactionsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreditTransactionsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<CreditTransactionsService>(CreditTransactionsService);
    jest.clearAllMocks();
  });

  // ─── findAll ───────────────────────────────────────────────────────────────

  describe("findAll", () => {
    it("ควร return items และ meta ที่ถูกต้อง", async () => {
      // Arrange
      mockPrisma.$transaction.mockResolvedValue([[mockTx], 1]);

      // Act
      const result = await service.findAll({ page: 1, limit: 10 });

      // Assert
      expect(result.items).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.totalPages).toBe(1);
    });

    it("ควรส่ง memberId filter เมื่อระบุ", async () => {
      // Arrange
      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      // Act
      await service.findAll({ page: 1, limit: 10, memberId: "m1" });

      // Assert
      const where = mockPrisma.creditTransaction.findMany.mock.calls[0][0].where;
      expect(where.memberId).toBe("m1");
    });

    it("ควรส่ง type filter เมื่อระบุ", async () => {
      // Arrange
      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      // Act
      await service.findAll({ page: 1, limit: 10, type: "EARN" });

      // Assert
      const where = mockPrisma.creditTransaction.findMany.mock.calls[0][0].where;
      expect(where.type).toBe("EARN");
    });

    it("ควรส่ง createdAt gte เมื่อมี dateFrom", async () => {
      // Arrange
      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      // Act
      await service.findAll({ page: 1, limit: 10, dateFrom: "2026-01-01" });

      // Assert
      const where = mockPrisma.creditTransaction.findMany.mock.calls[0][0].where;
      expect(where.createdAt.gte).toBeInstanceOf(Date);
      expect(where.createdAt.lte).toBeUndefined();
    });

    it("ควรส่ง createdAt lte (end of day) เมื่อมี dateTo", async () => {
      // Arrange
      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      // Act
      await service.findAll({ page: 1, limit: 10, dateTo: "2026-01-31" });

      // Assert
      const where = mockPrisma.creditTransaction.findMany.mock.calls[0][0].where;
      const lte: Date = where.createdAt.lte;
      expect(lte.getHours()).toBe(23);
      expect(lte.getMinutes()).toBe(59);
      expect(where.createdAt.gte).toBeUndefined();
    });

    it("ควรส่ง gte และ lte เมื่อมีทั้ง dateFrom และ dateTo", async () => {
      // Arrange
      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      // Act
      await service.findAll({ page: 1, limit: 10, dateFrom: "2026-01-01", dateTo: "2026-01-31" });

      // Assert
      const where = mockPrisma.creditTransaction.findMany.mock.calls[0][0].where;
      expect(where.createdAt.gte).toBeInstanceOf(Date);
      expect(where.createdAt.lte).toBeInstanceOf(Date);
    });

    it("ควรไม่ส่ง createdAt filter เมื่อไม่มี dateFrom และ dateTo", async () => {
      // Arrange
      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      // Act
      await service.findAll({ page: 1, limit: 10 });

      // Assert
      const where = mockPrisma.creditTransaction.findMany.mock.calls[0][0].where;
      expect(where.createdAt).toBeUndefined();
    });

    it("ควรคำนวณ totalPages=1 เมื่อไม่มีข้อมูล", async () => {
      // Arrange
      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      // Act
      const result = await service.findAll({ page: 1, limit: 10 });

      // Assert
      expect(result.meta.totalPages).toBe(1);
    });
  });
});
