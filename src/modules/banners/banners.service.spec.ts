import { NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { BannersService } from "./banners.service";
import { PrismaService } from "../prisma/prisma.service";

jest.mock("fs", () => ({
  existsSync: jest.fn(),
  mkdirSync:  jest.fn(),
  unlinkSync: jest.fn(),
}));
import { existsSync, unlinkSync } from "fs";
const mockExistsSync = existsSync as jest.Mock;
const mockUnlinkSync = unlinkSync as jest.Mock;

const mockBanner = {
  id: "b1",
  eyebrow: "New",
  title: "Summer Sale",
  body: null,
  tag: null,
  buttonLabel: "Shop Now",
  linkType: "none",
  linkId: null,
  sortOrder: 0,
  isActive: true,
  imageUrl: "http://localhost:3000/uploads/banners/old.jpg",
};

const mockPrisma = {
  banner: {
    findMany:  jest.fn(),
    findFirst: jest.fn(),
    create:    jest.fn(),
    update:    jest.fn(),
    delete:    jest.fn(),
    count:     jest.fn(),
  },
};

describe("BannersService", () => {
  let service: BannersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BannersService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<BannersService>(BannersService);
    jest.clearAllMocks();
  });

  // ─── findAll ───────────────────────────────────────────────────────────────

  describe("findAll", () => {
    it("ควร return banners ทั้งหมดเมื่อ activeOnly=false", async () => {
      // Arrange
      mockPrisma.banner.findMany.mockResolvedValue([mockBanner]);

      // Act
      const result = await service.findAll(false);

      // Assert
      expect(result).toHaveLength(1);
      expect(mockPrisma.banner.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: undefined }),
      );
    });

    it("ควรส่ง where: { isActive: true } เมื่อ activeOnly=true", async () => {
      // Arrange
      mockPrisma.banner.findMany.mockResolvedValue([mockBanner]);

      // Act
      await service.findAll(true);

      // Assert
      expect(mockPrisma.banner.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isActive: true } }),
      );
    });
  });

  // ─── findOne ───────────────────────────────────────────────────────────────

  describe("findOne", () => {
    it("ควร return banner เมื่อพบ", async () => {
      // Arrange
      mockPrisma.banner.findFirst.mockResolvedValue(mockBanner);

      // Act
      const result = await service.findOne("b1");

      // Assert
      expect(result.id).toBe("b1");
    });

    it("ควร throw NotFoundException เมื่อไม่พบ", async () => {
      // Arrange
      mockPrisma.banner.findFirst.mockResolvedValue(null);

      // Assert
      await expect(service.findOne("not-exist")).rejects.toThrow(NotFoundException);
    });
  });

  // ─── create ────────────────────────────────────────────────────────────────

  describe("create", () => {
    it("ควรใช้ count เป็น sortOrder default เมื่อไม่ได้ส่ง sortOrder", async () => {
      // Arrange
      mockPrisma.banner.count.mockResolvedValue(3);
      mockPrisma.banner.create.mockResolvedValue(mockBanner);

      // Act
      await service.create({ eyebrow: "New", title: "Sale" });

      // Assert
      const data = mockPrisma.banner.create.mock.calls[0][0].data;
      expect(data.sortOrder).toBe(3);
    });

    it("ควรใช้ sortOrder ที่ส่งมาแทน count", async () => {
      // Arrange
      mockPrisma.banner.count.mockResolvedValue(3);
      mockPrisma.banner.create.mockResolvedValue(mockBanner);

      // Act
      await service.create({ eyebrow: "New", title: "Sale", sortOrder: 10 });

      // Assert
      const data = mockPrisma.banner.create.mock.calls[0][0].data;
      expect(data.sortOrder).toBe(10);
    });

    it("ควรใช้ค่า default: buttonLabel='Shop Now', linkType='none', tag=null, linkId=null", async () => {
      // Arrange
      mockPrisma.banner.count.mockResolvedValue(0);
      mockPrisma.banner.create.mockResolvedValue(mockBanner);

      // Act
      await service.create({ eyebrow: "E", title: "T" });

      // Assert
      const data = mockPrisma.banner.create.mock.calls[0][0].data;
      expect(data.buttonLabel).toBe("Shop Now");
      expect(data.linkType).toBe("none");
      expect(data.tag).toBeNull();
      expect(data.linkId).toBeNull();
    });
  });

  // ─── update ────────────────────────────────────────────────────────────────

  describe("update", () => {
    it("ควรอัปเดต fields ที่ส่งมาได้ถูกต้อง", async () => {
      // Arrange
      mockPrisma.banner.findFirst.mockResolvedValue(mockBanner);
      mockPrisma.banner.update.mockResolvedValue({ ...mockBanner, title: "New Title" });

      // Act
      await service.update("b1", { title: "New Title" });

      // Assert
      expect(mockPrisma.banner.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "b1" },
          data: expect.objectContaining({ title: "New Title" }),
        }),
      );
    });

    it("ควร throw NotFoundException เมื่อไม่พบ banner", async () => {
      // Arrange
      mockPrisma.banner.findFirst.mockResolvedValue(null);

      // Assert
      await expect(service.update("not-exist", { title: "X" })).rejects.toThrow(NotFoundException);
    });
  });

  // ─── uploadImage ───────────────────────────────────────────────────────────

  describe("uploadImage", () => {
    const mockFile = { filename: "new.jpg" } as Express.Multer.File;

    it("ควรลบรูปเก่าและอัปเดต imageUrl ใหม่เมื่อ banner มี imageUrl เดิม", async () => {
      // Arrange
      mockPrisma.banner.findFirst.mockResolvedValue(mockBanner); // มี imageUrl
      mockExistsSync.mockReturnValue(true);
      mockPrisma.banner.update.mockResolvedValue(mockBanner);

      // Act
      await service.uploadImage("b1", mockFile);

      // Assert
      expect(mockUnlinkSync).toHaveBeenCalled();
      const data = mockPrisma.banner.update.mock.calls[0][0].data;
      expect(data.imageUrl).toContain("new.jpg");
    });

    it("ควรไม่เรียก unlinkSync เมื่อ banner ไม่มี imageUrl เดิม", async () => {
      // Arrange
      mockPrisma.banner.findFirst.mockResolvedValue({ ...mockBanner, imageUrl: null });
      mockExistsSync.mockReturnValue(false);
      mockPrisma.banner.update.mockResolvedValue(mockBanner);

      // Act
      await service.uploadImage("b1", mockFile);

      // Assert
      expect(mockUnlinkSync).not.toHaveBeenCalled();
      const data = mockPrisma.banner.update.mock.calls[0][0].data;
      expect(data.imageUrl).toContain("new.jpg");
    });

    it("ควร throw NotFoundException เมื่อไม่พบ banner", async () => {
      // Arrange
      mockPrisma.banner.findFirst.mockResolvedValue(null);

      // Assert
      await expect(service.uploadImage("not-exist", mockFile)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── reorder ───────────────────────────────────────────────────────────────

  describe("reorder", () => {
    it("ควรอัปเดต sortOrder ของแต่ละ banner และ return findAll", async () => {
      // Arrange
      mockPrisma.banner.update.mockResolvedValue(mockBanner);
      mockPrisma.banner.findMany.mockResolvedValue([mockBanner]);

      // Act
      const result = await service.reorder([
        { id: "b1", sortOrder: 0 },
        { id: "b2", sortOrder: 1 },
      ]);

      // Assert
      expect(mockPrisma.banner.update).toHaveBeenCalledTimes(2);
      expect(mockPrisma.banner.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "b1" }, data: { sortOrder: 0 } }),
      );
      expect(result).toHaveLength(1);
    });
  });

  // ─── remove ────────────────────────────────────────────────────────────────

  describe("remove", () => {
    it("ควรลบไฟล์รูปและลบ banner เมื่อมี imageUrl", async () => {
      // Arrange
      mockPrisma.banner.findFirst.mockResolvedValue(mockBanner); // มี imageUrl
      mockExistsSync.mockReturnValue(true);
      mockPrisma.banner.delete.mockResolvedValue(mockBanner);

      // Act
      await service.remove("b1");

      // Assert
      expect(mockUnlinkSync).toHaveBeenCalled();
      expect(mockPrisma.banner.delete).toHaveBeenCalledWith({ where: { id: "b1" } });
    });

    it("ควรไม่เรียก unlinkSync เมื่อ banner ไม่มี imageUrl", async () => {
      // Arrange
      mockPrisma.banner.findFirst.mockResolvedValue({ ...mockBanner, imageUrl: null });
      mockPrisma.banner.delete.mockResolvedValue(mockBanner);

      // Act
      await service.remove("b1");

      // Assert
      expect(mockUnlinkSync).not.toHaveBeenCalled();
      expect(mockPrisma.banner.delete).toHaveBeenCalled();
    });

    it("ควร throw NotFoundException เมื่อไม่พบ banner", async () => {
      // Arrange
      mockPrisma.banner.findFirst.mockResolvedValue(null);

      // Assert
      await expect(service.remove("not-exist")).rejects.toThrow(NotFoundException);
    });
  });
});
