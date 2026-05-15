import { NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { CategoriesService } from "./categories.service";
import { PrismaService } from "../prisma/prisma.service";

// mock fs ก่อน import service เพื่อ intercept filesystem calls
jest.mock("fs", () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  renameSync: jest.fn(),
  unlinkSync: jest.fn(),
}));
import { existsSync, renameSync } from "fs";
const mockExistsSync = existsSync as jest.Mock;
const mockRenameSync = renameSync as jest.Mock;

const mockCategory = {
  id: "c1",
  name: "Hair Color",
  slug: "hair-color",
  imageUrl: "http://localhost:3000/uploads/categories/old.jpg",
  isActive: true,
  deletedAt: null,
  _count: { products: 0 },
};

const mockPrisma = {
  category: {
    findMany:  jest.fn(),
    findFirst: jest.fn(),
    create:    jest.fn(),
    update:    jest.fn(),
    count:     jest.fn(),
  },
  $transaction: jest.fn(),
};

describe("CategoriesService", () => {
  let service: CategoriesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
    jest.clearAllMocks();
  });

  // ─── findAll ───────────────────────────────────────────────────────────────

  describe("findAll", () => {
    it("ควร return items และ meta ที่ถูกต้อง", async () => {
      // Arrange
      mockPrisma.$transaction.mockResolvedValue([[mockCategory], 1]);

      // Act
      const result = await service.findAll({ page: 1, pageSize: 10 });

      // Assert
      expect(result.items).toHaveLength(1);
      expect(result.meta.totalItems).toBe(1);
      expect(result.meta.totalPages).toBe(1);
    });

    it("ควรส่ง search filter เป็น OR clause ไปยัง Prisma", async () => {
      // Arrange
      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      // Act
      await service.findAll({ search: "color", page: 1, pageSize: 10 });

      // Assert — ดู argument ที่ส่งไปยัง findMany (ไม่ใช่ $transaction)
      const where = mockPrisma.category.findMany.mock.calls[0][0].where;
      expect(where.OR).toBeDefined();
    });

    it("ควรไม่ส่ง OR clause เมื่อไม่มี search", async () => {
      // Arrange
      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      // Act
      await service.findAll({ page: 1, pageSize: 10 });

      // Assert
      const where = mockPrisma.category.findMany.mock.calls[0][0].where;
      expect(where.OR).toBeUndefined();
    });

    it("ควรส่ง isActive=true เมื่อ status=active", async () => {
      // Arrange
      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      // Act
      await service.findAll({ status: "active", page: 1, pageSize: 10 });

      // Assert
      const where = mockPrisma.category.findMany.mock.calls[0][0].where;
      expect(where.isActive).toBe(true);
    });

    it("ควรส่ง isActive=false เมื่อ status=inactive", async () => {
      // Arrange
      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      // Act
      await service.findAll({ status: "inactive", page: 1, pageSize: 10 });

      // Assert
      const where = mockPrisma.category.findMany.mock.calls[0][0].where;
      expect(where.isActive).toBe(false);
    });

    it("ควรไม่ส่ง isActive เมื่อ status=all", async () => {
      // Arrange
      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      // Act
      await service.findAll({ status: "all", page: 1, pageSize: 10 });

      // Assert
      const where = mockPrisma.category.findMany.mock.calls[0][0].where;
      expect(where.isActive).toBeUndefined();
    });

    it("ควรคำนวณ hasNextPage และ hasPreviousPage ถูกต้อง", async () => {
      // Arrange — 25 items, pageSize 10, อยู่หน้า 2
      mockPrisma.$transaction.mockResolvedValue([[], 25]);

      // Act
      const result = await service.findAll({ page: 2, pageSize: 10 });

      // Assert
      expect(result.meta.totalPages).toBe(3);
      expect(result.meta.hasNextPage).toBe(true);
      expect(result.meta.hasPreviousPage).toBe(true);
    });
  });

  // ─── findOne ───────────────────────────────────────────────────────────────

  describe("findOne", () => {
    it("ควร return category เมื่อพบ", async () => {
      // Arrange
      mockPrisma.category.findFirst.mockResolvedValue(mockCategory);

      // Act
      const result = await service.findOne("c1");

      // Assert
      expect(result.id).toBe("c1");
    });

    it("ควร throw NotFoundException เมื่อไม่พบ", async () => {
      // Arrange
      mockPrisma.category.findFirst.mockResolvedValue(null);

      // Assert
      await expect(service.findOne("not-exist")).rejects.toThrow(NotFoundException);
    });
  });

  // ─── create ────────────────────────────────────────────────────────────────

  describe("create", () => {
    it("ควรใช้ imageUrl จาก payload เมื่อไม่มี tempImageFile", async () => {
      // Arrange
      mockPrisma.category.create.mockResolvedValue(mockCategory);

      // Act
      await service.create({ name: "Color", slug: "color", imageUrl: "http://img.jpg" });

      // Assert
      expect(mockPrisma.category.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ imageUrl: "http://img.jpg" }),
        })
      );
    });

    it("ควรย้ายไฟล์และใช้ URL ใหม่เมื่อมี tempImageFile", async () => {
      // Arrange
      mockExistsSync.mockReturnValue(true);  // ไฟล์ temp มีอยู่จริง
      mockRenameSync.mockImplementation(() => {});
      mockPrisma.category.create.mockResolvedValue(mockCategory);

      // Act
      await service.create({ name: "Color", slug: "color", tempImageFile: "new.jpg" });

      // Assert — renameSync ถูกเรียก (ย้ายไฟล์)
      expect(mockRenameSync).toHaveBeenCalled();
      // imageUrl ต้องเป็น URL ใหม่ ไม่ใช่ undefined
      const data = mockPrisma.category.create.mock.calls[0][0].data;
      expect(data.imageUrl).toContain("new.jpg");
    });
  });

  // ─── updateStatus ──────────────────────────────────────────────────────────

  describe("updateStatus", () => {
    it("ควรอัปเดต isActive ถูกต้อง", async () => {
      // Arrange
      mockPrisma.category.findFirst.mockResolvedValue(mockCategory);
      mockPrisma.category.update.mockResolvedValue({ ...mockCategory, isActive: false });

      // Act
      const result = await service.updateStatus("c1", false);

      // Assert
      expect(mockPrisma.category.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isActive: false }),
        })
      );
    });

    it("ควร throw เมื่อไม่พบ category", async () => {
      // Arrange
      mockPrisma.category.findFirst.mockResolvedValue(null);

      // Assert
      await expect(service.updateStatus("not-exist", true)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── remove ────────────────────────────────────────────────────────────────

  describe("remove", () => {
    it("ควร soft delete โดย set deletedAt และ isActive=false", async () => {
      // Arrange
      mockPrisma.category.findFirst.mockResolvedValue(mockCategory);
      mockPrisma.category.update.mockResolvedValue({ ...mockCategory, deletedAt: new Date(), isActive: false });

      // Act
      await service.remove("c1");

      // Assert
      expect(mockPrisma.category.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isActive: false,
            deletedAt: expect.any(Date),
          }),
        })
      );
    });

    it("ควร throw เมื่อไม่พบ category", async () => {
      // Arrange
      mockPrisma.category.findFirst.mockResolvedValue(null);

      // Assert
      await expect(service.remove("not-exist")).rejects.toThrow(NotFoundException);
    });
  });
});
