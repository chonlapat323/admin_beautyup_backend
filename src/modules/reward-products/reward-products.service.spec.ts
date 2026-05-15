import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { RewardProductsService } from "./reward-products.service";
import { PrismaService } from "../prisma/prisma.service";

jest.mock("fs", () => ({
  existsSync: jest.fn(),
  mkdirSync:  jest.fn(),
  renameSync: jest.fn(),
  unlinkSync: jest.fn(),
}));
import { existsSync, renameSync } from "fs";
const mockExistsSync = existsSync as jest.Mock;
const mockRenameSync = renameSync as jest.Mock;

const mockRewardProduct = {
  id: "rp1",
  name: "Free Shampoo",
  pointCost: 500,
  stock: 10,
  isActive: true,
  imageUrl: null,
  images: [],
};

// mock tx ใช้ใน interactive $transaction callback
const mockTx = {
  member:         { findUnique: jest.fn(), update: jest.fn() },
  rewardProduct:  { findUnique: jest.fn(), update: jest.fn() },
  rewardRedemption: { create: jest.fn() },
};

const mockPrisma = {
  rewardProduct: {
    findMany:   jest.fn(),
    findUnique: jest.fn(),
    create:     jest.fn(),
    update:     jest.fn(),
    delete:     jest.fn(),
  },
  rewardProductImage: {
    findMany: jest.fn(),
    create:   jest.fn(),
    update:   jest.fn(),
    delete:   jest.fn(),
  },
  rewardRedemption: { findMany: jest.fn() },
  $transaction: jest.fn(),
};

describe("RewardProductsService", () => {
  let service: RewardProductsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RewardProductsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<RewardProductsService>(RewardProductsService);
    jest.clearAllMocks();

    // default: interactive $transaction executes callback ด้วย mockTx
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockTx) => unknown) => fn(mockTx));
  });

  // ─── findAll ───────────────────────────────────────────────────────────────

  describe("findAll", () => {
    it("ควร return รายการสินค้าแลกแต้มทั้งหมด", async () => {
      // Arrange
      mockPrisma.rewardProduct.findMany.mockResolvedValue([mockRewardProduct]);

      // Act
      const result = await service.findAll();

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("rp1");
    });

    it("ควร return [] เมื่อไม่มีสินค้า", async () => {
      // Arrange
      mockPrisma.rewardProduct.findMany.mockResolvedValue([]);

      // Act
      const result = await service.findAll();

      // Assert
      expect(result).toEqual([]);
    });
  });

  // ─── findOne ───────────────────────────────────────────────────────────────

  describe("findOne", () => {
    it("ควร return สินค้าเมื่อพบ", async () => {
      // Arrange
      mockPrisma.rewardProduct.findUnique.mockResolvedValue(mockRewardProduct);

      // Act
      const result = await service.findOne("rp1");

      // Assert
      expect(result.id).toBe("rp1");
    });

    it("ควร throw NotFoundException เมื่อไม่พบ", async () => {
      // Arrange
      mockPrisma.rewardProduct.findUnique.mockResolvedValue(null);

      // Assert
      await expect(service.findOne("not-exist")).rejects.toThrow(NotFoundException);
    });
  });

  // ─── create ────────────────────────────────────────────────────────────────

  describe("create", () => {
    beforeEach(() => {
      mockPrisma.rewardProduct.create.mockResolvedValue({ id: "rp1" });
      mockPrisma.rewardProduct.findUnique.mockResolvedValue(mockRewardProduct);
      mockPrisma.rewardProductImage.findMany.mockResolvedValue([]);
    });

    it("ควรสร้างสินค้าโดยไม่มีรูปเมื่อไม่มี tempFiles", async () => {
      // Act
      await service.create({ name: "Shampoo", pointCost: 500, stock: 10 });

      // Assert
      expect(mockPrisma.rewardProduct.create).toHaveBeenCalled();
      expect(mockPrisma.rewardProductImage.create).not.toHaveBeenCalled();
    });

    it("ควรสร้าง image records เมื่อมี tempFiles และไฟล์มีอยู่จริง", async () => {
      // Arrange
      mockExistsSync.mockReturnValue(true);
      mockRenameSync.mockImplementation(() => {});

      // Act
      await service.create({ name: "Shampoo", pointCost: 500, stock: 10, tempFiles: ["img.jpg"] });

      // Assert
      expect(mockPrisma.rewardProductImage.create).toHaveBeenCalled();
    });

    it("ควร skip tempFiles ที่ไม่มีอยู่จริง", async () => {
      // Arrange
      mockExistsSync.mockReturnValue(false);

      // Act
      await service.create({ name: "Shampoo", pointCost: 500, stock: 10, tempFiles: ["missing.jpg"] });

      // Assert
      expect(mockPrisma.rewardProductImage.create).not.toHaveBeenCalled();
    });
  });

  // ─── update ────────────────────────────────────────────────────────────────

  describe("update", () => {
    beforeEach(() => {
      mockPrisma.rewardProduct.findUnique.mockResolvedValue(mockRewardProduct);
      mockPrisma.rewardProduct.update.mockResolvedValue(mockRewardProduct);
      mockPrisma.rewardProductImage.findMany.mockResolvedValue([]);
    });

    it("ควรเรียก update เมื่อมี fields ที่ต้องการแก้ไข", async () => {
      // Act
      await service.update("rp1", { name: "New Name" });

      // Assert
      expect(mockPrisma.rewardProduct.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "rp1" }, data: expect.objectContaining({ name: "New Name" }) })
      );
    });

    it("ควรไม่เรียก update เมื่อส่งแค่ orderedImages (ไม่มี field อื่น)", async () => {
      // Act
      await service.update("rp1", { orderedImages: [] });

      // Assert — rewardProduct.update ถูกเรียกแค่จาก applyOrderedImages (imageUrl sync) ไม่ใช่จาก rest
      const updateCalls = mockPrisma.rewardProduct.update.mock.calls;
      const fieldUpdateCall = updateCalls.find((c) => c[0].data?.name !== undefined);
      expect(fieldUpdateCall).toBeUndefined();
    });

    it("ควรเรียก applyOrderedImages เมื่อมี orderedImages", async () => {
      // Act
      await service.update("rp1", { orderedImages: [] });

      // Assert — rewardProductImage.findMany ถูกเรียกใน applyOrderedImages
      expect(mockPrisma.rewardProductImage.findMany).toHaveBeenCalled();
    });

    it("ควรไม่เรียก applyOrderedImages เมื่อไม่มี orderedImages", async () => {
      // Act
      await service.update("rp1", { name: "New" });

      // Assert
      expect(mockPrisma.rewardProductImage.findMany).not.toHaveBeenCalled();
    });

    it("ควร throw NotFoundException เมื่อไม่พบ", async () => {
      // Arrange
      mockPrisma.rewardProduct.findUnique.mockResolvedValue(null);

      // Assert
      await expect(service.update("not-exist", { name: "X" })).rejects.toThrow(NotFoundException);
    });
  });

  // ─── applyOrderedImages (via update) ──────────────────────────────────────

  describe("applyOrderedImages", () => {
    beforeEach(() => {
      mockPrisma.rewardProduct.findUnique.mockResolvedValue(mockRewardProduct);
      mockPrisma.rewardProduct.update.mockResolvedValue(mockRewardProduct);
    });

    it("ควรลบ image ที่ไม่อยู่ใน orderedImages", async () => {
      // Arrange
      mockPrisma.rewardProductImage.findMany.mockResolvedValue([
        { id: "img1", url: "http://localhost/rewards/img1.jpg" },
      ]);
      mockExistsSync.mockReturnValue(false);

      // Act
      await service.update("rp1", { orderedImages: [] });

      // Assert
      expect(mockPrisma.rewardProductImage.delete).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "img1" } })
      );
    });

    it("ควร update sortOrder ของ existing image", async () => {
      // Arrange
      mockPrisma.rewardProductImage.findMany.mockResolvedValue([
        { id: "img1", url: "http://localhost/img1.jpg" },
      ]);

      // Act
      await service.update("rp1", { orderedImages: [{ kind: "existing", id: "img1" }] });

      // Assert
      expect(mockPrisma.rewardProductImage.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "img1" }, data: { sortOrder: 0 } })
      );
    });

    it("ควร sync imageUrl เป็นรูปแรกเมื่อมี image", async () => {
      // Arrange
      mockPrisma.rewardProductImage.findMany.mockResolvedValue([
        { id: "img1", url: "http://localhost/first.jpg" },
      ]);

      // Act
      await service.update("rp1", { orderedImages: [{ kind: "existing", id: "img1" }] });

      // Assert — rewardProduct.update ถูกเรียกด้วย imageUrl ของรูปแรก
      expect(mockPrisma.rewardProduct.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { imageUrl: "http://localhost/first.jpg" } })
      );
    });

    it("ควร set imageUrl=null เมื่อ orderedImages เป็น []", async () => {
      // Arrange
      mockPrisma.rewardProductImage.findMany.mockResolvedValue([]);

      // Act
      await service.update("rp1", { orderedImages: [] });

      // Assert
      expect(mockPrisma.rewardProduct.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { imageUrl: null } })
      );
    });

    it("ควรสร้าง image จาก temp file เมื่อไฟล์มีอยู่จริง", async () => {
      // Arrange
      mockPrisma.rewardProductImage.findMany.mockResolvedValue([]);
      mockExistsSync.mockReturnValue(true);
      mockRenameSync.mockImplementation(() => {});

      // Act
      await service.update("rp1", { orderedImages: [{ kind: "temp", filename: "new.jpg" }] });

      // Assert
      expect(mockPrisma.rewardProductImage.create).toHaveBeenCalled();
    });

    it("ควร skip temp file ที่ไม่มีอยู่จริง", async () => {
      // Arrange
      mockPrisma.rewardProductImage.findMany.mockResolvedValue([]);
      mockExistsSync.mockReturnValue(false);

      // Act
      await service.update("rp1", { orderedImages: [{ kind: "temp", filename: "missing.jpg" }] });

      // Assert
      expect(mockPrisma.rewardProductImage.create).not.toHaveBeenCalled();
    });
  });

  // ─── remove ────────────────────────────────────────────────────────────────

  describe("remove", () => {
    it("ควรลบสินค้าพร้อมไฟล์รูปภาพ", async () => {
      // Arrange
      mockPrisma.rewardProduct.findUnique.mockResolvedValue({
        ...mockRewardProduct,
        images: [{ url: "http://localhost/rewards/img1.jpg" }],
      });
      mockPrisma.rewardProduct.delete.mockResolvedValue(mockRewardProduct);
      mockExistsSync.mockReturnValue(false);

      // Act
      await service.remove("rp1");

      // Assert
      expect(mockPrisma.rewardProduct.delete).toHaveBeenCalledWith({ where: { id: "rp1" } });
    });

    it("ควร throw NotFoundException เมื่อไม่พบ", async () => {
      // Arrange
      mockPrisma.rewardProduct.findUnique.mockResolvedValue(null);

      // Assert
      await expect(service.remove("not-exist")).rejects.toThrow(NotFoundException);
    });
  });

  // ─── listActive ────────────────────────────────────────────────────────────

  describe("listActive", () => {
    it("ควร query เฉพาะ isActive=true และ stock > 0", async () => {
      // Arrange
      mockPrisma.rewardProduct.findMany.mockResolvedValue([mockRewardProduct]);

      // Act
      await service.listActive();

      // Assert
      expect(mockPrisma.rewardProduct.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true, stock: { gt: 0 } },
        })
      );
    });
  });

  // ─── getRedemptions ────────────────────────────────────────────────────────

  describe("getRedemptions", () => {
    it("ควร return รายการทั้งหมดเมื่อไม่มี date filter", async () => {
      // Arrange
      mockPrisma.rewardRedemption.findMany.mockResolvedValue([]);

      // Act
      await service.getRedemptions();

      // Assert — where ต้องว่าง
      const where = mockPrisma.rewardRedemption.findMany.mock.calls[0][0].where;
      expect(where.createdAt).toBeUndefined();
    });

    it("ควรส่งเฉพาะ gte เมื่อมีแค่ from", async () => {
      // Arrange
      mockPrisma.rewardRedemption.findMany.mockResolvedValue([]);

      // Act
      await service.getRedemptions("2026-01-01");

      // Assert
      const { createdAt } = mockPrisma.rewardRedemption.findMany.mock.calls[0][0].where;
      expect(createdAt.gte).toEqual(new Date("2026-01-01"));
      expect(createdAt.lte).toBeUndefined();
    });

    it("ควรส่งเฉพาะ lte (end of day) เมื่อมีแค่ to", async () => {
      // Arrange
      mockPrisma.rewardRedemption.findMany.mockResolvedValue([]);

      // Act
      await service.getRedemptions(undefined, "2026-01-31");

      // Assert
      const { createdAt } = mockPrisma.rewardRedemption.findMany.mock.calls[0][0].where;
      expect(createdAt.lte.getHours()).toBe(23);
      expect(createdAt.gte).toBeUndefined();
    });

    it("ควรส่งทั้ง gte และ lte เมื่อมีทั้ง from และ to", async () => {
      // Arrange
      mockPrisma.rewardRedemption.findMany.mockResolvedValue([]);

      // Act
      await service.getRedemptions("2026-01-01", "2026-01-31");

      // Assert
      const { createdAt } = mockPrisma.rewardRedemption.findMany.mock.calls[0][0].where;
      expect(createdAt.gte).toEqual(new Date("2026-01-01"));
      expect(createdAt.lte).toBeInstanceOf(Date);
    });
  });

  // ─── redeem ────────────────────────────────────────────────────────────────

  describe("redeem", () => {
    const mockMember  = { id: "m1", pointBalance: 1000 };
    const mockProduct = { id: "rp1", isActive: true, stock: 5, pointCost: 500 };

    beforeEach(() => {
      mockTx.member.findUnique.mockResolvedValue(mockMember);
      mockTx.rewardProduct.findUnique.mockResolvedValue(mockProduct);
      mockTx.member.update.mockResolvedValue({});
      mockTx.rewardProduct.update.mockResolvedValue({});
      mockTx.rewardRedemption.create.mockResolvedValue({ id: "red1" });
    });

    it("ควรแลกแต้มสำเร็จและ return redemption record", async () => {
      // Act
      const result = await service.redeem("m1", "rp1");

      // Assert
      expect(mockTx.member.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { pointBalance: { decrement: 500 } } })
      );
      expect(mockTx.rewardProduct.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { stock: { decrement: 1 } } })
      );
      expect(result).toEqual({ id: "red1" });
    });

    it("ควร throw NotFoundException เมื่อไม่พบสินค้า", async () => {
      // Arrange
      mockTx.rewardProduct.findUnique.mockResolvedValue(null);

      // Assert
      await expect(service.redeem("m1", "rp1")).rejects.toThrow(NotFoundException);
    });

    it("ควร throw NotFoundException เมื่อสินค้า isActive=false", async () => {
      // Arrange
      mockTx.rewardProduct.findUnique.mockResolvedValue({ ...mockProduct, isActive: false });

      // Assert
      await expect(service.redeem("m1", "rp1")).rejects.toThrow(NotFoundException);
    });

    it("ควร throw BadRequestException เมื่อสินค้าหมด (stock=0)", async () => {
      // Arrange
      mockTx.rewardProduct.findUnique.mockResolvedValue({ ...mockProduct, stock: 0 });

      // Assert
      await expect(service.redeem("m1", "rp1")).rejects.toThrow(BadRequestException);
    });

    it("ควร throw NotFoundException เมื่อไม่พบสมาชิก", async () => {
      // Arrange
      mockTx.member.findUnique.mockResolvedValue(null);

      // Assert
      await expect(service.redeem("m1", "rp1")).rejects.toThrow(NotFoundException);
    });

    it("ควร throw BadRequestException เมื่อแต้มไม่พอ", async () => {
      // Arrange
      mockTx.member.findUnique.mockResolvedValue({ ...mockMember, pointBalance: 100 });

      // Assert
      await expect(service.redeem("m1", "rp1")).rejects.toThrow(BadRequestException);
    });
  });
});
