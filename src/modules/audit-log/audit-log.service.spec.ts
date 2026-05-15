import { Test, TestingModule } from "@nestjs/testing";
import { AuditLogService } from "./audit-log.service";
import { PrismaService } from "../prisma/prisma.service";

const mockPrisma = {
  auditLog: {
    create:  jest.fn(),
    findMany: jest.fn(),
    count:   jest.fn(),
  },
  $transaction: jest.fn(),
};

describe("AuditLogService", () => {
  let service: AuditLogService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AuditLogService>(AuditLogService);
    jest.clearAllMocks();
  });

  // ─── log ───────────────────────────────────────────────────────────────────

  describe("log", () => {
    it("ควรเรียก prisma.auditLog.create ด้วย entry ที่ส่งมา", async () => {
      // Arrange
      mockPrisma.auditLog.create.mockResolvedValue({});
      const entry = { adminEmail: "admin@test.com", action: "member.update", entityType: "member", entityId: "m1" };

      // Act
      await service.log(entry);

      // Assert
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({ data: entry });
    });

    it("ควรไม่ throw เมื่อ create ล้มเหลว (silently catch)", async () => {
      // Arrange
      mockPrisma.auditLog.create.mockRejectedValue(new Error("DB error"));

      // Act & Assert — ต้องไม่ throw
      await expect(
        service.log({ adminEmail: "a", action: "x", entityType: "y", entityId: "z" }),
      ).resolves.toBeUndefined();
    });
  });

  // ─── findAll ───────────────────────────────────────────────────────────────

  describe("findAll", () => {
    it("ควร return items และ meta ที่ถูกต้อง", async () => {
      // Arrange
      mockPrisma.$transaction.mockResolvedValue([[{ id: "al1" }], 1]);

      // Act
      const result = await service.findAll({ page: 1, limit: 10 });

      // Assert
      expect(result.items).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.totalPages).toBe(1);
    });

    it("ควรส่ง OR clause เมื่อมี search", async () => {
      // Arrange
      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      // Act
      await service.findAll({ page: 1, limit: 10, search: "admin" });

      // Assert
      const where = mockPrisma.auditLog.findMany.mock.calls[0][0].where;
      expect(where.OR).toBeDefined();
    });

    it("ควรส่ง entityType filter เมื่อระบุ", async () => {
      // Arrange
      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      // Act
      await service.findAll({ page: 1, limit: 10, entityType: "member" });

      // Assert
      const where = mockPrisma.auditLog.findMany.mock.calls[0][0].where;
      expect(where.entityType).toBe("member");
    });

    it("ควรส่ง gte เมื่อมีแค่ dateFrom", async () => {
      // Arrange
      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      // Act
      await service.findAll({ page: 1, limit: 10, dateFrom: "2026-01-01" });

      // Assert
      const where = mockPrisma.auditLog.findMany.mock.calls[0][0].where;
      expect(where.createdAt.gte).toBeInstanceOf(Date);
      expect(where.createdAt.lte).toBeUndefined();
    });

    it("ควรส่ง lte (end of day) เมื่อมีแค่ dateTo", async () => {
      // Arrange
      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      // Act
      await service.findAll({ page: 1, limit: 10, dateTo: "2026-01-31" });

      // Assert
      const where = mockPrisma.auditLog.findMany.mock.calls[0][0].where;
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
      const where = mockPrisma.auditLog.findMany.mock.calls[0][0].where;
      expect(where.createdAt.gte).toBeInstanceOf(Date);
      expect(where.createdAt.lte).toBeInstanceOf(Date);
    });

    it("ควรไม่ส่ง createdAt filter เมื่อไม่มี dateFrom และ dateTo", async () => {
      // Arrange
      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      // Act
      await service.findAll({ page: 1, limit: 10 });

      // Assert
      const where = mockPrisma.auditLog.findMany.mock.calls[0][0].where;
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
