import { NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { StockService } from "./stock.service";
import { PrismaService } from "../prisma/prisma.service";
import { AuditLogService } from "../audit-log/audit-log.service";

const mockProduct = { id: "p1", name: "Product A", sku: "SKU-A", stock: 10, reserveStock: 1, sellableStock: 9, status: "ACTIVE" };

const mockTx = {
  product:       { findUnique: jest.fn(), update: jest.fn() },
  stockMovement: { create: jest.fn() },
  orderItem:     { findMany: jest.fn() },
};

const mockPrisma = {
  product:       { findMany: jest.fn() },
  stockMovement: { findMany: jest.fn() },
  $transaction:  jest.fn(),
};

const mockAuditLog = { log: jest.fn() };

describe("StockService", () => {
  let service: StockService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StockService,
        { provide: PrismaService,   useValue: mockPrisma },
        { provide: AuditLogService, useValue: mockAuditLog },
      ],
    }).compile();

    service = module.get<StockService>(StockService);
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx));
  });

  // ─── summary ───────────────────────────────────────────────────────────────

  describe("summary", () => {
    it("ควร return products พร้อม stock fields", async () => {
      // Arrange
      mockPrisma.product.findMany.mockResolvedValue([mockProduct]);

      // Act
      const result = await service.summary();

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].stock).toBe(10);
    });

    it("ควร return [] เมื่อไม่มีสินค้า", async () => {
      // Arrange
      mockPrisma.product.findMany.mockResolvedValue([]);

      // Act
      const result = await service.summary();

      // Assert
      expect(result).toEqual([]);
    });
  });

  // ─── adjust ────────────────────────────────────────────────────────────────

  describe("adjust", () => {
    it("ควรคำนวณ stock, reserveStock, sellableStock ได้ถูกต้อง", async () => {
      // Arrange — stock=10, delta=+5 → newStock=15, reserve=ceil(15*0.1)=2, sellable=13
      mockTx.product.findUnique.mockResolvedValue(mockProduct);
      mockTx.product.update.mockResolvedValue({});
      mockTx.stockMovement.create.mockResolvedValue({});

      // Act
      const result = await service.adjust({ productId: "p1", delta: 5, reason: "restock" });

      // Assert
      expect(result.stock).toBe(15);
      expect(result.reserveStock).toBe(2);
      expect(result.sellableStock).toBe(13);
      expect(mockTx.product.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ stock: 15, reserveStock: 2, sellableStock: 13 }) }),
      );
    });

    it("ควร floor stock ที่ 0 เมื่อ delta ทำให้ stock ติดลบ", async () => {
      // Arrange — stock=10, delta=-20 → newStock=max(0,−10)=0
      mockTx.product.findUnique.mockResolvedValue(mockProduct);
      mockTx.product.update.mockResolvedValue({});
      mockTx.stockMovement.create.mockResolvedValue({});

      // Act
      const result = await service.adjust({ productId: "p1", delta: -20, reason: "correction" });

      // Assert
      expect(result.stock).toBe(0);
      expect(result.reserveStock).toBe(0);
      expect(result.sellableStock).toBe(0);
    });

    it("ควรสร้าง StockMovement พร้อม type=ADJUSTMENT", async () => {
      // Arrange
      mockTx.product.findUnique.mockResolvedValue(mockProduct);
      mockTx.product.update.mockResolvedValue({});
      mockTx.stockMovement.create.mockResolvedValue({});

      // Act
      await service.adjust({ productId: "p1", delta: 3, reason: "manual" });

      // Assert
      expect(mockTx.stockMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ productId: "p1", delta: 3, type: "ADJUSTMENT" }),
        }),
      );
    });

    it("ควร throw NotFoundException เมื่อไม่พบสินค้า", async () => {
      // Arrange
      mockTx.product.findUnique.mockResolvedValue(null);

      // Assert
      await expect(service.adjust({ productId: "not-exist", delta: 1, reason: "x" })).rejects.toThrow(NotFoundException);
    });
  });

  // ─── movements ─────────────────────────────────────────────────────────────

  describe("movements", () => {
    it("ควร return movements ทั้งหมดเมื่อไม่ระบุ productId", async () => {
      // Arrange
      mockPrisma.stockMovement.findMany.mockResolvedValue([{ id: "sm1" }]);

      // Act
      await service.movements();

      // Assert
      expect(mockPrisma.stockMovement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: undefined }),
      );
    });

    it("ควรส่ง where: { productId } เมื่อระบุ productId", async () => {
      // Arrange
      mockPrisma.stockMovement.findMany.mockResolvedValue([]);

      // Act
      await service.movements("p1");

      // Assert
      expect(mockPrisma.stockMovement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { productId: "p1" } }),
      );
    });
  });

  // ─── decrementForOrder ─────────────────────────────────────────────────────

  describe("decrementForOrder", () => {
    it("ควรลด stock ต่อ item และสร้าง StockMovement type=SALE", async () => {
      // Arrange — stock=10, quantity=2 → newStock=8, reserve=ceil(0.8)=1, sellable=7
      const localTx = {
        orderItem:     { findMany: jest.fn().mockResolvedValue([{ productId: "p1", quantity: 2 }]) },
        product:       { findUnique: jest.fn().mockResolvedValue({ id: "p1", stock: 10 }), update: jest.fn().mockResolvedValue({}) },
        stockMovement: { create: jest.fn().mockResolvedValue({}) },
      };

      // Act
      await service.decrementForOrder("o1", localTx as never);

      // Assert
      expect(localTx.product.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ stock: 8 }) }),
      );
      expect(localTx.stockMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ delta: -2, type: "SALE" }) }),
      );
    });

    it("ควร skip item ที่ไม่พบ product โดยไม่ throw", async () => {
      // Arrange
      const localTx = {
        orderItem:     { findMany: jest.fn().mockResolvedValue([{ productId: "missing", quantity: 1 }]) },
        product:       { findUnique: jest.fn().mockResolvedValue(null), update: jest.fn() },
        stockMovement: { create: jest.fn() },
      };

      // Act & Assert — ต้องไม่ throw
      await expect(service.decrementForOrder("o1", localTx as never)).resolves.toBeUndefined();
      expect(localTx.product.update).not.toHaveBeenCalled();
    });
  });
});
