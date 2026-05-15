import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { SalonCodesService } from "./salon-codes.service";
import { PrismaService } from "../prisma/prisma.service";

const mockCode = {
  id: "sc1",
  code: "SALON001",
  description: "Test code",
  usageLimit: null,
  usedCount: 0,
  expiresAt: null,
  isActive: true,
  _count: { members: 0 },
};

const mockPrisma = {
  salonCode: {
    findMany:  jest.fn(),
    findUnique: jest.fn(),
    create:    jest.fn(),
    update:    jest.fn(),
    delete:    jest.fn(),
  },
};

describe("SalonCodesService", () => {
  let service: SalonCodesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SalonCodesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<SalonCodesService>(SalonCodesService);
    jest.clearAllMocks();
  });

  // ─── findAll ───────────────────────────────────────────────────────────────

  describe("findAll", () => {
    it("ควร return salon codes ทั้งหมด", async () => {
      // Arrange
      mockPrisma.salonCode.findMany.mockResolvedValue([mockCode]);

      // Act
      const result = await service.findAll();

      // Assert
      expect(result).toHaveLength(1);
    });
  });

  // ─── findOne ───────────────────────────────────────────────────────────────

  describe("findOne", () => {
    it("ควร return code เมื่อพบ", async () => {
      // Arrange
      mockPrisma.salonCode.findUnique.mockResolvedValue(mockCode);

      // Act
      const result = await service.findOne("sc1");

      // Assert
      expect(result.id).toBe("sc1");
    });

    it("ควร throw NotFoundException เมื่อไม่พบ", async () => {
      // Arrange
      mockPrisma.salonCode.findUnique.mockResolvedValue(null);

      // Assert
      await expect(service.findOne("not-exist")).rejects.toThrow(NotFoundException);
    });
  });

  // ─── create ────────────────────────────────────────────────────────────────

  describe("create", () => {
    it("ควร uppercase code และสร้าง salon code ได้ถูกต้อง", async () => {
      // Arrange
      mockPrisma.salonCode.findUnique.mockResolvedValue(null); // ไม่ซ้ำ
      mockPrisma.salonCode.create.mockResolvedValue(mockCode);

      // Act
      await service.create({ code: "salon001" });

      // Assert
      const data = mockPrisma.salonCode.create.mock.calls[0][0].data;
      expect(data.code).toBe("SALON001");
    });

    it("ควรตั้ง expiresAt เป็น Date เมื่อส่ง expiresAt มา", async () => {
      // Arrange
      mockPrisma.salonCode.findUnique.mockResolvedValue(null);
      mockPrisma.salonCode.create.mockResolvedValue(mockCode);

      // Act
      await service.create({ code: "TEST01", expiresAt: "2026-12-31" });

      // Assert
      const data = mockPrisma.salonCode.create.mock.calls[0][0].data;
      expect(data.expiresAt).toBeInstanceOf(Date);
    });

    it("ควร throw BadRequestException เมื่อ code ซ้ำ", async () => {
      // Arrange
      mockPrisma.salonCode.findUnique.mockResolvedValue(mockCode); // มีอยู่แล้ว

      // Assert
      await expect(service.create({ code: "SALON001" })).rejects.toThrow(BadRequestException);
    });
  });

  // ─── update ────────────────────────────────────────────────────────────────

  describe("update", () => {
    it("ควรอัปเดต fields ที่ส่งมาได้ถูกต้อง", async () => {
      // Arrange
      mockPrisma.salonCode.findUnique.mockResolvedValue(mockCode);
      mockPrisma.salonCode.update.mockResolvedValue({ ...mockCode, isActive: false });

      // Act
      await service.update("sc1", { isActive: false });

      // Assert
      expect(mockPrisma.salonCode.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "sc1" } }),
      );
    });

    it("ควร throw NotFoundException เมื่อไม่พบ code", async () => {
      // Arrange
      mockPrisma.salonCode.findUnique.mockResolvedValue(null);

      // Assert
      await expect(service.update("not-exist", { isActive: true })).rejects.toThrow(NotFoundException);
    });

    it("ควรตั้ง expiresAt เป็น null เมื่อส่ง expiresAt=null", async () => {
      // Arrange
      mockPrisma.salonCode.findUnique.mockResolvedValue(mockCode);
      mockPrisma.salonCode.update.mockResolvedValue(mockCode);

      // Act
      await service.update("sc1", { expiresAt: null });

      // Assert
      const data = mockPrisma.salonCode.update.mock.calls[0][0].data;
      expect(data.expiresAt).toBeNull();
    });
  });

  // ─── remove ────────────────────────────────────────────────────────────────

  describe("remove", () => {
    it("ควรลบ code ที่ไม่มีสมาชิกใช้งาน", async () => {
      // Arrange
      mockPrisma.salonCode.findUnique.mockResolvedValue(mockCode); // _count.members = 0
      mockPrisma.salonCode.delete.mockResolvedValue(mockCode);

      // Act
      await service.remove("sc1");

      // Assert
      expect(mockPrisma.salonCode.delete).toHaveBeenCalledWith({ where: { id: "sc1" } });
    });

    it("ควร throw BadRequestException เมื่อมีสมาชิกใช้งานแล้ว", async () => {
      // Arrange
      mockPrisma.salonCode.findUnique.mockResolvedValue({ ...mockCode, _count: { members: 3 } });

      // Assert
      await expect(service.remove("sc1")).rejects.toThrow(BadRequestException);
    });

    it("ควร throw NotFoundException เมื่อไม่พบ code", async () => {
      // Arrange
      mockPrisma.salonCode.findUnique.mockResolvedValue(null);

      // Assert
      await expect(service.remove("not-exist")).rejects.toThrow(NotFoundException);
    });
  });

  // ─── validate ──────────────────────────────────────────────────────────────

  describe("validate", () => {
    it("ควร return { id } เมื่อ code ถูกต้องและยังใช้ได้", async () => {
      // Arrange
      mockPrisma.salonCode.findUnique.mockResolvedValue(mockCode);

      // Act
      const result = await service.validate("SALON001");

      // Assert
      expect(result).toEqual({ id: "sc1" });
    });

    it("ควร return null เมื่อไม่พบ code", async () => {
      // Arrange
      mockPrisma.salonCode.findUnique.mockResolvedValue(null);

      // Act
      const result = await service.validate("NOT-EXIST");

      // Assert
      expect(result).toBeNull();
    });

    it("ควร return null เมื่อ isActive=false", async () => {
      // Arrange
      mockPrisma.salonCode.findUnique.mockResolvedValue({ ...mockCode, isActive: false });

      // Act
      const result = await service.validate("SALON001");

      // Assert
      expect(result).toBeNull();
    });

    it("ควร return null เมื่อ code หมดอายุแล้ว", async () => {
      // Arrange
      const pastDate = new Date("2020-01-01");
      mockPrisma.salonCode.findUnique.mockResolvedValue({ ...mockCode, expiresAt: pastDate });

      // Act
      const result = await service.validate("SALON001");

      // Assert
      expect(result).toBeNull();
    });

    it("ควร return null เมื่อใช้งานครบ usageLimit", async () => {
      // Arrange
      mockPrisma.salonCode.findUnique.mockResolvedValue({ ...mockCode, usageLimit: 5, usedCount: 5 });

      // Act
      const result = await service.validate("SALON001");

      // Assert
      expect(result).toBeNull();
    });

    it("ควร return { id } เมื่อ usageLimit=null (ไม่จำกัด)", async () => {
      // Arrange
      mockPrisma.salonCode.findUnique.mockResolvedValue({ ...mockCode, usageLimit: null, usedCount: 999 });

      // Act
      const result = await service.validate("SALON001");

      // Assert
      expect(result).toEqual({ id: "sc1" });
    });
  });

  // ─── incrementUsed ─────────────────────────────────────────────────────────

  describe("incrementUsed", () => {
    it("ควรเพิ่ม usedCount ทีละ 1", async () => {
      // Arrange
      mockPrisma.salonCode.update.mockResolvedValue({ ...mockCode, usedCount: 1 });

      // Act
      await service.incrementUsed("sc1");

      // Assert
      expect(mockPrisma.salonCode.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "sc1" },
          data: { usedCount: { increment: 1 } },
        }),
      );
    });
  });
});
