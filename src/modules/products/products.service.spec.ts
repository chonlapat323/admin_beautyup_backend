import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { ProductStatus } from "@prisma/client";
import { ProductsService } from "./products.service";
import { PrismaService } from "../prisma/prisma.service";
import { FlowAccountService } from "../flowaccount/flowaccount.service";

jest.mock("fs", () => ({
  existsSync: jest.fn(),
  mkdirSync:  jest.fn(),
  renameSync: jest.fn(),
  unlinkSync: jest.fn(),
}));
import { existsSync, renameSync } from "fs";
const mockExistsSync = existsSync as jest.Mock;
const mockRenameSync = renameSync as jest.Mock;

const mockProduct = {
  id: "p1",
  sku: "SKU-1",
  name: "Product A",
  slug: "product-a",
  price: 100,
  specialPrice: null,
  stock: 10,
  reserveStock: 1,
  sellableStock: 9,
  status: ProductStatus.ACTIVE,
  isFeatured: false,
  flowAccountItemId: null,
  category: { id: "c1", name: "Color" },
  shade: null,
  images: [],
};

const mockPrisma = {
  product: {
    findMany:  jest.fn(),
    findFirst: jest.fn(),
    create:    jest.fn(),
    update:    jest.fn(),
    delete:    jest.fn(),
    count:     jest.fn(),
  },
  productImage: {
    findMany:  jest.fn(),
    findFirst: jest.fn(),
    create:    jest.fn(),
    update:    jest.fn(),
    delete:    jest.fn(),
  },
  orderItem: { count: jest.fn() },
  $transaction: jest.fn(),
};

const mockFlowAccount = {
  createItem: jest.fn(),
  updateItem: jest.fn(),
};

describe("ProductsService", () => {
  let service: ProductsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: PrismaService,      useValue: mockPrisma },
        { provide: FlowAccountService, useValue: mockFlowAccount },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
    jest.clearAllMocks();

    // FlowAccount background sync — ไม่ต้องการผลลัพธ์ใน test
    mockFlowAccount.createItem.mockResolvedValue(null);
    mockFlowAccount.updateItem.mockResolvedValue(undefined);
  });

  // ─── findAll ───────────────────────────────────────────────────────────────

  describe("findAll", () => {
    it("ควร return items และ meta ที่ถูกต้อง", async () => {
      // Arrange
      mockPrisma.$transaction.mockResolvedValue([[mockProduct], 1]);

      // Act
      const result = await service.findAll({ page: 1, pageSize: 10 });

      // Assert
      expect(result.items).toHaveLength(1);
      expect(result.meta.totalItems).toBe(1);
    });

    it("ควร return [] และ totalPages=1 เมื่อไม่มีสินค้า", async () => {
      // Arrange
      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      // Act
      const result = await service.findAll({ page: 1, pageSize: 10 });

      // Assert
      expect(result.items).toEqual([]);
      expect(result.meta.totalPages).toBe(1);
    });

    it("ควรส่ง OR clause เมื่อมี search", async () => {
      // Arrange
      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      // Act
      await service.findAll({ search: "color", page: 1, pageSize: 10 });

      // Assert
      const where = mockPrisma.product.findMany.mock.calls[0][0].where;
      expect(where.OR).toBeDefined();
    });

    it("ควรไม่ส่ง OR clause เมื่อไม่มี search", async () => {
      // Arrange
      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      // Act
      await service.findAll({ page: 1, pageSize: 10 });

      // Assert
      const where = mockPrisma.product.findMany.mock.calls[0][0].where;
      expect(where.OR).toBeUndefined();
    });

    it.each([
      ["active",   ProductStatus.ACTIVE],
      ["inactive", ProductStatus.INACTIVE],
      ["draft",    ProductStatus.DRAFT],
    ])("ควรส่ง status=%s filter ถูกต้อง", async (status, expected) => {
      // Arrange
      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      // Act
      await service.findAll({ status: status as never, page: 1, pageSize: 10 });

      // Assert
      const where = mockPrisma.product.findMany.mock.calls[0][0].where;
      expect(where.status).toBe(expected);
    });

    it("ควรไม่ส่ง status filter เมื่อ status=all", async () => {
      // Arrange
      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      // Act
      await service.findAll({ status: "all", page: 1, pageSize: 10 });

      // Assert
      const where = mockPrisma.product.findMany.mock.calls[0][0].where;
      expect(where.status).toBeUndefined();
    });

    it("ควรส่ง categoryId filter เมื่อระบุ", async () => {
      // Arrange
      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      // Act
      await service.findAll({ categoryId: "c1", page: 1, pageSize: 10 });

      // Assert
      const where = mockPrisma.product.findMany.mock.calls[0][0].where;
      expect(where.categoryId).toBe("c1");
    });

    it("ควรส่ง brandId filter เมื่อระบุ", async () => {
      // Arrange
      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      // Act
      await service.findAll({ brandId: "b1", page: 1, pageSize: 10 });

      // Assert
      const where = mockPrisma.product.findMany.mock.calls[0][0].where;
      expect(where.brandId).toBe("b1");
    });

    it("ควรส่ง collectionId filter เมื่อระบุ", async () => {
      // Arrange
      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      // Act
      await service.findAll({ collectionId: "col1", page: 1, pageSize: 10 });

      // Assert
      const where = mockPrisma.product.findMany.mock.calls[0][0].where;
      expect(where.collectionId).toBe("col1");
    });

    it("ควรส่ง isFeatured=true filter เมื่อระบุ", async () => {
      // Arrange
      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      // Act
      await service.findAll({ isFeatured: true, page: 1, pageSize: 10 });

      // Assert
      const where = mockPrisma.product.findMany.mock.calls[0][0].where;
      expect(where.isFeatured).toBe(true);
    });

    it("ควรคำนวณ pagination meta ถูกต้อง", async () => {
      // Arrange — 25 items, pageSize 10, หน้า 2
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
    it("ควร return product เมื่อพบ", async () => {
      // Arrange
      mockPrisma.product.findFirst.mockResolvedValue(mockProduct);

      // Act
      const result = await service.findOne("p1");

      // Assert
      expect(result.id).toBe("p1");
    });

    it("ควร throw NotFoundException เมื่อไม่พบ", async () => {
      // Arrange
      mockPrisma.product.findFirst.mockResolvedValue(null);

      // Assert
      await expect(service.findOne("not-exist")).rejects.toThrow(NotFoundException);
    });
  });

  // ─── create ────────────────────────────────────────────────────────────────

  describe("create", () => {
    beforeEach(() => {
      mockPrisma.product.create.mockResolvedValue({ id: "p1" });
      mockPrisma.product.findFirst.mockResolvedValue(mockProduct);
    });

    it("ควรคำนวณ reserveStock และ sellableStock ถูกต้อง (10% reserve)", async () => {
      // Act
      await service.create({ sku: "S1", name: "A", slug: "a", price: 100, categoryId: "c1", stock: 10 });

      // Assert — stock=10, reserveStock=ceil(10*0.1)=1, sellableStock=9
      expect(mockPrisma.product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ stock: 10, reserveStock: 1, sellableStock: 9 }),
        })
      );
    });

    it("ควรใช้ stock=0 เป็น default เมื่อไม่ระบุ", async () => {
      // Act
      await service.create({ sku: "S1", name: "A", slug: "a", price: 100, categoryId: "c1" });

      // Assert
      expect(mockPrisma.product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ stock: 0, reserveStock: 0, sellableStock: 0 }),
        })
      );
    });

    it("ควรสร้าง productImage เมื่อมี tempFiles และไฟล์มีอยู่จริง", async () => {
      // Arrange
      mockExistsSync.mockReturnValue(true);
      mockRenameSync.mockImplementation(() => {});

      // Act
      await service.create({ sku: "S1", name: "A", slug: "a", price: 100, categoryId: "c1", tempFiles: ["img1.jpg"] });

      // Assert
      expect(mockPrisma.productImage.create).toHaveBeenCalledTimes(1);
    });

    it("ควร skip ไฟล์ที่ไม่มีอยู่จริงใน tempFiles", async () => {
      // Arrange — ไฟล์ไม่มีอยู่จริง
      mockExistsSync.mockReturnValue(false);

      // Act
      await service.create({ sku: "S1", name: "A", slug: "a", price: 100, categoryId: "c1", tempFiles: ["missing.jpg"] });

      // Assert — productImage.create ต้องไม่ถูกเรียก
      expect(mockPrisma.productImage.create).not.toHaveBeenCalled();
    });

    it("ควรไม่สร้าง productImage เมื่อไม่มี tempFiles", async () => {
      // Act
      await service.create({ sku: "S1", name: "A", slug: "a", price: 100, categoryId: "c1" });

      // Assert
      expect(mockPrisma.productImage.create).not.toHaveBeenCalled();
    });
  });

  // ─── update ────────────────────────────────────────────────────────────────

  describe("update", () => {
    beforeEach(() => {
      mockPrisma.product.findFirst.mockResolvedValue(mockProduct);
      mockPrisma.product.update.mockResolvedValue(mockProduct);
      mockPrisma.productImage.findMany.mockResolvedValue([]);
    });

    it("ควรคำนวณ stockFields เมื่อมีการส่ง stock", async () => {
      // Act
      await service.update("p1", { stock: 20 });

      // Assert — stock=20, reserveStock=ceil(20*0.1)=2, sellableStock=18
      expect(mockPrisma.product.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ stock: 20, reserveStock: 2, sellableStock: 18 }),
        })
      );
    });

    it("ควรไม่ส่ง stockFields เมื่อไม่ได้ระบุ stock", async () => {
      // Act
      await service.update("p1", { name: "New Name" });

      // Assert
      const data = mockPrisma.product.update.mock.calls[0][0].data;
      expect(data.stock).toBeUndefined();
      expect(data.reserveStock).toBeUndefined();
    });

    it("ควรเรียก applyOrderedImages เมื่อมี orderedImages", async () => {
      // Act
      await service.update("p1", { orderedImages: [] });

      // Assert — productImage.findMany ถูกเรียก (ใน applyOrderedImages)
      expect(mockPrisma.productImage.findMany).toHaveBeenCalled();
    });

    it("ควรไม่เรียก applyOrderedImages เมื่อไม่มี orderedImages", async () => {
      // Act
      await service.update("p1", { name: "New" });

      // Assert
      expect(mockPrisma.productImage.findMany).not.toHaveBeenCalled();
    });

    it("ควรเรียก FlowAccount updateItem เมื่อ product มี flowAccountItemId", async () => {
      // Arrange
      const productWithFA = { ...mockProduct, flowAccountItemId: "fa-123" };
      mockPrisma.product.findFirst.mockResolvedValue(productWithFA);

      // Act
      await service.update("p1", { name: "New" });

      // Assert
      expect(mockFlowAccount.updateItem).toHaveBeenCalledWith("fa-123", expect.any(Object));
    });

    it("ควรไม่เรียก FlowAccount updateItem เมื่อไม่มี flowAccountItemId", async () => {
      // Arrange — mockProduct มี flowAccountItemId: null
      // Act
      await service.update("p1", { name: "New" });

      // Assert
      expect(mockFlowAccount.updateItem).not.toHaveBeenCalled();
    });

    it("ควร throw NotFoundException เมื่อไม่พบ product", async () => {
      // Arrange
      mockPrisma.product.findFirst.mockResolvedValue(null);

      // Assert
      await expect(service.update("not-exist", { name: "X" })).rejects.toThrow(NotFoundException);
    });
  });

  // ─── applyOrderedImages (via update) ──────────────────────────────────────

  describe("applyOrderedImages", () => {
    beforeEach(() => {
      mockPrisma.product.findFirst.mockResolvedValue(mockProduct);
      mockPrisma.product.update.mockResolvedValue(mockProduct);
    });

    it("ควรลบ image ที่ไม่อยู่ใน orderedImages", async () => {
      // Arrange — existing มี img1 แต่ orderedImages ว่าง
      mockPrisma.productImage.findMany.mockResolvedValue([
        { id: "img1", url: "http://localhost/uploads/products/img1.jpg" },
      ]);
      mockExistsSync.mockReturnValue(false); // ไม่มีไฟล์จริง (ไม่ต้องลบไฟล์)

      // Act
      await service.update("p1", { orderedImages: [] });

      // Assert — ลบ record ออกจาก DB
      expect(mockPrisma.productImage.delete).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "img1" } })
      );
    });

    it("ควร update sortOrder ของ existing image", async () => {
      // Arrange
      mockPrisma.productImage.findMany.mockResolvedValue([
        { id: "img1", url: "http://localhost/img1.jpg" },
      ]);

      // Act
      await service.update("p1", { orderedImages: [{ kind: "existing", id: "img1" }] });

      // Assert
      expect(mockPrisma.productImage.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "img1" }, data: { sortOrder: 0 } })
      );
    });

    it("ควรสร้าง image จาก temp file เมื่อไฟล์มีอยู่จริง", async () => {
      // Arrange
      mockPrisma.productImage.findMany.mockResolvedValue([]);
      mockExistsSync.mockReturnValue(true);
      mockRenameSync.mockImplementation(() => {});

      // Act
      await service.update("p1", { orderedImages: [{ kind: "temp", filename: "new.jpg" }] });

      // Assert
      expect(mockPrisma.productImage.create).toHaveBeenCalled();
    });

    it("ควร skip temp file ที่ไม่มีอยู่จริง", async () => {
      // Arrange
      mockPrisma.productImage.findMany.mockResolvedValue([]);
      mockExistsSync.mockReturnValue(false);

      // Act
      await service.update("p1", { orderedImages: [{ kind: "temp", filename: "missing.jpg" }] });

      // Assert
      expect(mockPrisma.productImage.create).not.toHaveBeenCalled();
    });
  });

  // ─── updateStatus ──────────────────────────────────────────────────────────

  describe("updateStatus", () => {
    it("ควร update status ถูกต้อง", async () => {
      // Arrange
      mockPrisma.product.findFirst.mockResolvedValue(mockProduct);
      mockPrisma.product.update.mockResolvedValue({ ...mockProduct, status: ProductStatus.INACTIVE });

      // Act
      await service.updateStatus("p1", ProductStatus.INACTIVE);

      // Assert
      expect(mockPrisma.product.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: ProductStatus.INACTIVE }) })
      );
    });

    it("ควร throw NotFoundException เมื่อไม่พบ product", async () => {
      // Arrange
      mockPrisma.product.findFirst.mockResolvedValue(null);

      // Assert
      await expect(service.updateStatus("not-exist", ProductStatus.ACTIVE)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── remove ────────────────────────────────────────────────────────────────

  describe("remove", () => {
    it("ควรลบ product เมื่อไม่มี order ที่เกี่ยวข้อง", async () => {
      // Arrange
      mockPrisma.product.findFirst.mockResolvedValue(mockProduct);
      mockPrisma.orderItem.count.mockResolvedValue(0);
      mockPrisma.product.delete.mockResolvedValue(mockProduct);

      // Act
      await service.remove("p1");

      // Assert
      expect(mockPrisma.product.delete).toHaveBeenCalledWith({ where: { id: "p1" } });
    });

    it("ควร throw BadRequestException เมื่อมี order ที่ใช้ product นี้อยู่", async () => {
      // Arrange
      mockPrisma.product.findFirst.mockResolvedValue(mockProduct);
      mockPrisma.orderItem.count.mockResolvedValue(3);

      // Assert
      await expect(service.remove("p1")).rejects.toThrow(BadRequestException);
    });

    it("ควร throw NotFoundException เมื่อไม่พบ product", async () => {
      // Arrange
      mockPrisma.product.findFirst.mockResolvedValue(null);

      // Assert
      await expect(service.remove("not-exist")).rejects.toThrow(NotFoundException);
    });
  });

  // ─── addImage ──────────────────────────────────────────────────────────────

  describe("addImage", () => {
    const mockFile = { filename: "img.jpg" } as Express.Multer.File;

    it("ควรใช้ sortOrder=0 เมื่อยังไม่มีรูปในสินค้า", async () => {
      // Arrange
      mockPrisma.product.findFirst.mockResolvedValue(mockProduct);
      mockPrisma.productImage.findFirst.mockResolvedValue(null); // ยังไม่มีรูป
      mockPrisma.productImage.create.mockResolvedValue({});

      // Act
      await service.addImage("p1", mockFile);

      // Assert
      expect(mockPrisma.productImage.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ sortOrder: 0 }) })
      );
    });

    it("ควรใช้ sortOrder = last.sortOrder + 1 เมื่อมีรูปอยู่แล้ว", async () => {
      // Arrange
      mockPrisma.product.findFirst.mockResolvedValue(mockProduct);
      mockPrisma.productImage.findFirst.mockResolvedValue({ sortOrder: 2 }); // มีรูปอยู่แล้ว
      mockPrisma.productImage.create.mockResolvedValue({});

      // Act
      await service.addImage("p1", mockFile);

      // Assert
      expect(mockPrisma.productImage.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ sortOrder: 3 }) })
      );
    });

    it("ควร throw NotFoundException เมื่อไม่พบ product", async () => {
      // Arrange
      mockPrisma.product.findFirst.mockResolvedValue(null);

      // Assert
      await expect(service.addImage("not-exist", mockFile)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── removeImage ───────────────────────────────────────────────────────────

  describe("removeImage", () => {
    it("ควรลบ image เมื่อพบ", async () => {
      // Arrange
      mockPrisma.productImage.findFirst.mockResolvedValue({ id: "img1", url: "http://localhost/img1.jpg" });
      mockExistsSync.mockReturnValue(false);
      mockPrisma.productImage.delete.mockResolvedValue({});

      // Act
      const result = await service.removeImage("p1", "img1");

      // Assert
      expect(mockPrisma.productImage.delete).toHaveBeenCalledWith({ where: { id: "img1" } });
      expect(result).toEqual({ message: "Image deleted" });
    });

    it("ควร throw NotFoundException เมื่อไม่พบ image", async () => {
      // Arrange
      mockPrisma.productImage.findFirst.mockResolvedValue(null);

      // Assert
      await expect(service.removeImage("p1", "not-exist")).rejects.toThrow(NotFoundException);
    });
  });
});
