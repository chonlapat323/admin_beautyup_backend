import { Test, TestingModule } from "@nestjs/testing";
import { OrdersService } from "./orders.service";
import { PrismaService } from "../prisma/prisma.service";
import { CommissionService } from "../commission/commission.service";
import { StockService } from "../stock/stock.service";
import { AuditLogService } from "../audit-log/audit-log.service";

const mockOrder = {
  id: "o1",
  status: "PENDING",
  memberId: "m1",
  pointEarned: 50,
  totalAmount: "500",
};

const mockTx = {
  order:          { update: jest.fn() },
  orderStatusLog: { create: jest.fn() },
  member:         { update: jest.fn() },
};

const mockPrisma = {
  order: {
    findMany:  jest.fn(),
    findUnique: jest.fn(),
    update:    jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockCommission = { createForOrder: jest.fn() };
const mockStock      = { decrementForOrder: jest.fn() };
const mockAuditLog   = { log: jest.fn() };

describe("OrdersService", () => {
  let service: OrdersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService,      useValue: mockPrisma },
        { provide: CommissionService,  useValue: mockCommission },
        { provide: StockService,       useValue: mockStock },
        { provide: AuditLogService,    useValue: mockAuditLog },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    jest.clearAllMocks();

    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx));
    mockTx.order.update.mockResolvedValue({ id: "o1", status: "DELIVERED" });
    mockTx.orderStatusLog.create.mockResolvedValue({});
    mockTx.member.update.mockResolvedValue({});
    mockCommission.createForOrder.mockResolvedValue(null);
    mockStock.decrementForOrder.mockResolvedValue(undefined);
  });

  // ─── findAll ───────────────────────────────────────────────────────────────

  describe("findAll", () => {
    it("ควร return orders พร้อม member info", async () => {
      // Arrange
      mockPrisma.order.findMany.mockResolvedValue([{ ...mockOrder, member: { fullName: "Alice" } }]);

      // Act
      const result = await service.findAll();

      // Assert
      expect(result).toHaveLength(1);
    });
  });

  // ─── findOne ───────────────────────────────────────────────────────────────

  describe("findOne", () => {
    it("ควร return order พร้อม items และ statusLogs", async () => {
      // Arrange
      mockPrisma.order.findUnique.mockResolvedValue({ ...mockOrder, items: [], statusLogs: [] });

      // Act
      const result = await service.findOne("o1");

      // Assert
      expect(result?.id).toBe("o1");
    });
  });

  // ─── updateStatus ──────────────────────────────────────────────────────────

  describe("updateStatus", () => {
    it("ควร throw เมื่อไม่พบ order", async () => {
      // Arrange
      mockPrisma.order.findUnique.mockResolvedValue(null);

      // Assert
      await expect(service.updateStatus("not-exist", "PAID", "admin")).rejects.toThrow("Order not found");
    });

    it("เมื่อ DELIVERED ครั้งแรกและ pointEarned > 0 ควร award points ให้ member", async () => {
      // Arrange
      mockPrisma.order.findUnique.mockResolvedValue({ ...mockOrder, status: "PROCESSING", pointEarned: 50, memberId: "m1" });
      mockTx.order.update.mockResolvedValue({ id: "o1", status: "DELIVERED" });

      // Act
      await service.updateStatus("o1", "DELIVERED", "admin");

      // Assert
      expect(mockTx.member.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "m1" }, data: { pointBalance: { increment: 50 } } }),
      );
    });

    it("เมื่อ DELIVERED แต่ pointEarned=0 ควรไม่ award points", async () => {
      // Arrange
      mockPrisma.order.findUnique.mockResolvedValue({ ...mockOrder, status: "PROCESSING", pointEarned: 0, memberId: "m1" });
      mockTx.order.update.mockResolvedValue({ id: "o1", status: "DELIVERED" });

      // Act
      await service.updateStatus("o1", "DELIVERED", "admin");

      // Assert
      expect(mockTx.member.update).not.toHaveBeenCalled();
    });

    it("เมื่อ order เป็น DELIVERED อยู่แล้ว ควรไม่ award points ซ้ำ", async () => {
      // Arrange
      mockPrisma.order.findUnique.mockResolvedValue({ ...mockOrder, status: "DELIVERED", pointEarned: 50, memberId: "m1" });
      mockTx.order.update.mockResolvedValue({ id: "o1", status: "DELIVERED" });

      // Act
      await service.updateStatus("o1", "DELIVERED", "admin");

      // Assert
      expect(mockTx.member.update).not.toHaveBeenCalled();
    });

    it("เมื่อ PAID ครั้งแรกควรเรียก decrementForOrder และ createForOrder", async () => {
      // Arrange
      mockPrisma.order.findUnique.mockResolvedValue({ ...mockOrder, status: "PENDING", pointEarned: 0, memberId: "m1" });
      mockTx.order.update.mockResolvedValue({ id: "o1", status: "PAID" });

      // Act
      await service.updateStatus("o1", "PAID", "admin");

      // Assert
      expect(mockStock.decrementForOrder).toHaveBeenCalledWith("o1", mockTx);
      expect(mockCommission.createForOrder).toHaveBeenCalledWith("o1");
    });

    it("เมื่อ order เป็น PAID อยู่แล้ว ควรไม่เรียก decrementForOrder และ createForOrder", async () => {
      // Arrange
      mockPrisma.order.findUnique.mockResolvedValue({ ...mockOrder, status: "PAID", pointEarned: 0, memberId: "m1" });
      mockTx.order.update.mockResolvedValue({ id: "o1", status: "PAID" });

      // Act
      await service.updateStatus("o1", "PAID", "admin");

      // Assert
      expect(mockStock.decrementForOrder).not.toHaveBeenCalled();
      expect(mockCommission.createForOrder).not.toHaveBeenCalled();
    });
  });

  // ─── updateTracking ────────────────────────────────────────────────────────

  describe("updateTracking", () => {
    it("ควรอัปเดต trackingNumber และ return message", async () => {
      // Arrange
      mockPrisma.order.findUnique.mockResolvedValue({ id: "o1" });
      mockPrisma.order.update.mockResolvedValue({});

      // Act
      const result = await service.updateTracking("o1", "TH123456789");

      // Assert
      expect(mockPrisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { trackingNumber: "TH123456789" } }),
      );
      expect(result.trackingNumber).toBe("TH123456789");
    });

    it("ควร throw เมื่อไม่พบ order", async () => {
      // Arrange
      mockPrisma.order.findUnique.mockResolvedValue(null);

      // Assert
      await expect(service.updateTracking("not-exist", "TH999")).rejects.toThrow("Order not found");
    });
  });
});
