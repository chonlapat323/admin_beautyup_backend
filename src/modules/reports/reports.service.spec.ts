import { Test, TestingModule } from "@nestjs/testing";
import { ReportsService } from "./reports.service";
import { PrismaService } from "../prisma/prisma.service";

const mockPrisma = {
  orderItem: { findMany: jest.fn() },
  order: { findMany: jest.fn() },
  product: { findMany: jest.fn() },
};

describe("ReportsService", () => {
  let service: ReportsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
    jest.clearAllMocks();
  });

  describe("salesByProduct", () => {
    it("ควรรวม quantity และ revenue ของ product เดียวกัน", async () => {
      // Arrange
      mockPrisma.orderItem.findMany.mockResolvedValue([
        { productId: "p1", name: "Product A", sku: "SKU-A", quantity: 2, totalPrice: "100" },
        { productId: "p1", name: "Product A", sku: "SKU-A", quantity: 3, totalPrice: "150" },
      ]);

      // Act
      const result = await service.salesByProduct({});

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].quantity).toBe(5);
      expect(result[0].revenue).toBe(250);
    });

    it("ควร sort ตาม revenue จากมากไปน้อย", async () => {
      // Arrange
      mockPrisma.orderItem.findMany.mockResolvedValue([
        { productId: "p1", name: "Cheap", sku: "S1", quantity: 1, totalPrice: "50" },
        { productId: "p2", name: "Expensive", sku: "S2", quantity: 1, totalPrice: "500" },
      ]);

      // Act
      const result = await service.salesByProduct({});

      // Assert
      expect(result[0].productId).toBe("p2");
      expect(result[1].productId).toBe("p1");
    });

    it("ควร return [] เมื่อไม่มี order", async () => {
      // Arrange
      mockPrisma.orderItem.findMany.mockResolvedValue([]);

      // Act
      const result = await service.salesByProduct({});

      // Assert
      expect(result).toEqual([]);
    });

    it("ควรส่ง createdAt filter ไปยัง Prisma เมื่อมี dateFrom และ dateTo", async () => {
      // Arrange
      mockPrisma.orderItem.findMany.mockResolvedValue([]);

      // Act
      await service.salesByProduct({ dateFrom: "2026-01-01", dateTo: "2026-01-31" });

      // Assert
      expect(mockPrisma.orderItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            order: expect.objectContaining({
              createdAt: expect.objectContaining({
                gte: new Date("2026-01-01"),
              }),
            }),
          }),
        })
      );
    });
  });

  describe("salesByMember", () => {
    it("ควรรวม orderCount และ totalSpent ต่อ member", async () => {
      // Arrange
      mockPrisma.order.findMany.mockResolvedValue([
        { memberId: "m1", totalAmount: "300", member: { fullName: "Alice", email: "a@test.com" } },
        { memberId: "m1", totalAmount: "200", member: { fullName: "Alice", email: "a@test.com" } },
        { memberId: "m2", totalAmount: "100", member: { fullName: "Bob", email: "b@test.com" } },
      ]);

      // Act
      const result = await service.salesByMember({});

      // Assert
      expect(result).toHaveLength(2);
      const alice = result.find((r) => r.memberId === "m1")!;
      expect(alice.orderCount).toBe(2);
      expect(alice.totalSpent).toBe(500);
    });

    it("ควร sort ตาม totalSpent จากมากไปน้อย", async () => {
      // Arrange
      mockPrisma.order.findMany.mockResolvedValue([
        { memberId: "m1", totalAmount: "100", member: { fullName: "Alice", email: "a@test.com" } },
        { memberId: "m2", totalAmount: "900", member: { fullName: "Bob", email: "b@test.com" } },
      ]);

      // Act
      const result = await service.salesByMember({});

      // Assert
      expect(result[0].memberId).toBe("m2");
    });

    it("ควร skip order ที่ไม่มี memberId", async () => {
      // Arrange
      mockPrisma.order.findMany.mockResolvedValue([
        { memberId: null, totalAmount: "500", member: null },
        { memberId: "m1", totalAmount: "200", member: { fullName: "Alice", email: "a@test.com" } },
      ]);

      // Act
      const result = await service.salesByMember({});

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].memberId).toBe("m1");
    });

    it("ควรส่ง createdAt filter ไปยัง Prisma เมื่อมี dateFrom และ dateTo", async () => {
      // Arrange
      mockPrisma.order.findMany.mockResolvedValue([]);

      // Act
      await service.salesByMember({ dateFrom: "2026-01-01", dateTo: "2026-01-31" });

      // Assert
      expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: expect.objectContaining({
              gte: new Date("2026-01-01"),
            }),
          }),
        })
      );
    });
  });

  describe("stockReport", () => {
    it("ควร map status ถูกต้องตาม stock", async () => {
      // Arrange
      mockPrisma.product.findMany.mockResolvedValue([
        { id: "p1", name: "Product Out", sku: "S1", stock: 0 },
        { id: "p2", name: "Product Low", sku: "S2", stock: 3 },
        { id: "p3", name: "Product Normal", sku: "S3", stock: 10 },
      ]);

      // Act
      const result = await service.stockReport();

      // Assert
      expect(result.find((p) => p.id === "p1")?.status).toBe("OUT_OF_STOCK");
      expect(result.find((p) => p.id === "p2")?.status).toBe("LOW");
      expect(result.find((p) => p.id === "p3")?.status).toBe("NORMAL");
    });

    it("stock = 5 ควรเป็น LOW (boundary: stock <= 5)", async () => {
      // Arrange
      mockPrisma.product.findMany.mockResolvedValue([
        { id: "p1", name: "Product", sku: "S1", stock: 5 },
      ]);

      // Act
      const result = await service.stockReport();

      // Assert
      expect(result[0].status).toBe("LOW");
    });

    it("ควร return [] เมื่อไม่มีสินค้า", async () => {
      // Arrange
      mockPrisma.product.findMany.mockResolvedValue([]);

      // Act
      const result = await service.stockReport();

      // Assert
      expect(result).toEqual([]);
    });
  });
});
