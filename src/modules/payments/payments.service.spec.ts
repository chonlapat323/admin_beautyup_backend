import { Test, TestingModule } from "@nestjs/testing";
import { PaymentsService } from "./payments.service";
import { PrismaService } from "../prisma/prisma.service";

const mockPrisma = {
  order: { findMany: jest.fn() },
};

describe("PaymentsService", () => {
  let service: PaymentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    jest.clearAllMocks();
  });

  // ─── findAll ───────────────────────────────────────────────────────────────

  describe("findAll", () => {
    it("ควร map orders เป็น payment records พร้อม method และ amount", async () => {
      // Arrange
      mockPrisma.order.findMany.mockResolvedValue([
        { paymentMethod: "CREDIT_CARD", totalAmount: "500" },
        { paymentMethod: "QR_CODE", totalAmount: "250.50" },
      ]);

      // Act
      const result = await service.findAll();

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].method).toBe("CREDIT_CARD");
      expect(result[0].amount).toBe(500);
      expect(result[0].status).toBe("PAID");
      expect(result[1].amount).toBe(250.5);
    });

    it("ควร return [] เมื่อไม่มี orders", async () => {
      // Arrange
      mockPrisma.order.findMany.mockResolvedValue([]);

      // Act
      const result = await service.findAll();

      // Assert
      expect(result).toEqual([]);
    });

    it("ควรส่ง where filter ที่ถูกต้องไปยัง Prisma (ไม่รวม CANCELLED และ null paymentMethod)", async () => {
      // Arrange
      mockPrisma.order.findMany.mockResolvedValue([]);

      // Act
      await service.findAll();

      // Assert
      expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { not: "CANCELLED" },
            paymentMethod: { not: null },
          }),
        }),
      );
    });

    it("ควรแปลง totalAmount จาก string เป็น number ด้วย Number()", async () => {
      // Arrange
      mockPrisma.order.findMany.mockResolvedValue([
        { paymentMethod: "PROMPTPAY", totalAmount: "1234.56" },
      ]);

      // Act
      const result = await service.findAll();

      // Assert
      expect(typeof result[0].amount).toBe("number");
      expect(result[0].amount).toBe(1234.56);
    });

    it("ควรกำหนด status เป็น PAID ให้ทุก record", async () => {
      // Arrange
      mockPrisma.order.findMany.mockResolvedValue([
        { paymentMethod: "BANK_TRANSFER", totalAmount: "100" },
        { paymentMethod: "CREDIT_CARD", totalAmount: "200" },
      ]);

      // Act
      const result = await service.findAll();

      // Assert
      result.forEach((r) => expect(r.status).toBe("PAID"));
    });
  });

  // ─── retry ─────────────────────────────────────────────────────────────────

  describe("retry", () => {
    it("ควร return message พร้อม orderId ที่ส่งเข้ามา", () => {
      // Act
      const result = service.retry("o1");

      // Assert
      expect(result.orderId).toBe("o1");
      expect(result.message).toBeDefined();
    });

    it("ควร return orderId ตรงกับที่ส่งเข้ามาในทุก case", () => {
      // Arrange
      const orderId = "order-xyz-999";

      // Act
      const result = service.retry(orderId);

      // Assert
      expect(result.orderId).toBe(orderId);
    });

    it("ควร return object ที่มี key message และ orderId", () => {
      // Act
      const result = service.retry("any-id");

      // Assert
      expect(result).toHaveProperty("message");
      expect(result).toHaveProperty("orderId");
    });
  });
});
