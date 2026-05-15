import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { Prisma } from "@prisma/client";
import { MembersService } from "./members.service";
import { PrismaService } from "../prisma/prisma.service";
import { FlowAccountService } from "../flowaccount/flowaccount.service";
import { AuditLogService } from "../audit-log/audit-log.service";

const mockMember = {
  id: "m1",
  fullName: "Alice",
  email: "alice@test.com",
  phone: "0812345678",
  isActive: true,
  flowAccountContactId: null,
  _count: { orders: 0, referrals: 0 },
  referredBy: null,
};

const mockAddress = {
  id: "a1",
  memberId: "m1",
  recipient: "Alice",
  phone: "0812345678",
  addressLine1: "123 Main St",
  isDefault: false,
};

const mockPrisma = {
  member: {
    findMany:   jest.fn(),
    findUnique: jest.fn(),
    create:     jest.fn(),
    update:     jest.fn(),
    delete:     jest.fn(),
    count:      jest.fn(),
  },
  memberAddress: {
    findMany:   jest.fn(),
    findFirst:  jest.fn(),
    create:     jest.fn(),
    update:     jest.fn(),
    updateMany: jest.fn(),
    delete:     jest.fn(),
    count:      jest.fn(),
  },
  creditTransaction: {
    findMany: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockFlowAccount = {
  createContact:          jest.fn(),
  updateContactAddress:   jest.fn(),
};

const mockAuditLog = { log: jest.fn() };

describe("MembersService", () => {
  let service: MembersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MembersService,
        { provide: PrismaService,      useValue: mockPrisma },
        { provide: FlowAccountService, useValue: mockFlowAccount },
        { provide: AuditLogService,    useValue: mockAuditLog },
      ],
    }).compile();

    service = module.get<MembersService>(MembersService);
    jest.clearAllMocks();
  });

  // ─── findAll ───────────────────────────────────────────────────────────────

  describe("findAll", () => {
    it("ควร return items และ meta ที่ถูกต้อง", async () => {
      // Arrange
      mockPrisma.$transaction.mockResolvedValue([[mockMember], 1]);

      // Act
      const result = await service.findAll({ page: 1, pageSize: 10 });

      // Assert
      expect(result.items).toHaveLength(1);
      expect(result.meta.totalItems).toBe(1);
      expect(result.meta.totalPages).toBe(1);
    });

    it("ควรส่ง OR clause เมื่อมี search", async () => {
      // Arrange
      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      // Act
      await service.findAll({ search: "alice", page: 1, pageSize: 10 });

      // Assert
      const where = mockPrisma.member.findMany.mock.calls[0][0].where;
      expect(where.OR).toBeDefined();
    });

    it("ควรส่ง isActive=true เมื่อ status=active", async () => {
      // Arrange
      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      // Act
      await service.findAll({ status: "active", page: 1, pageSize: 10 });

      // Assert
      const where = mockPrisma.member.findMany.mock.calls[0][0].where;
      expect(where.isActive).toBe(true);
    });

    it("ควรส่ง isActive=false เมื่อ status=inactive", async () => {
      // Arrange
      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      // Act
      await service.findAll({ status: "inactive", page: 1, pageSize: 10 });

      // Assert
      const where = mockPrisma.member.findMany.mock.calls[0][0].where;
      expect(where.isActive).toBe(false);
    });

    it("ควรคำนวณ pagination meta ได้ถูกต้อง", async () => {
      // Arrange — 25 items, pageSize 10, page 2
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
    it("ควร return member เมื่อพบ", async () => {
      // Arrange
      mockPrisma.member.findUnique.mockResolvedValue(mockMember);

      // Act
      const result = await service.findOne("m1");

      // Assert
      expect(result.id).toBe("m1");
    });

    it("ควร throw NotFoundException เมื่อไม่พบ", async () => {
      // Arrange
      mockPrisma.member.findUnique.mockResolvedValue(null);

      // Assert
      await expect(service.findOne("not-exist")).rejects.toThrow(NotFoundException);
    });
  });

  // ─── create ────────────────────────────────────────────────────────────────

  describe("create", () => {
    it("ควรสร้าง member และ sync flowAccount contactId เมื่อ createContact return id", async () => {
      // Arrange
      mockPrisma.member.create.mockResolvedValue(mockMember);
      mockFlowAccount.createContact.mockResolvedValue("fa-contact-1");
      mockPrisma.member.update.mockResolvedValue({ ...mockMember, flowAccountContactId: "fa-contact-1" });

      // Act
      const result = await service.create({ fullName: "Alice" });

      // Assert
      expect(mockPrisma.member.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { flowAccountContactId: "fa-contact-1" } }),
      );
      expect(result.flowAccountContactId).toBe("fa-contact-1");
    });

    it("ควร return member โดยไม่ update เมื่อ createContact return null", async () => {
      // Arrange
      mockPrisma.member.create.mockResolvedValue(mockMember);
      mockFlowAccount.createContact.mockResolvedValue(null);

      // Act
      await service.create({ fullName: "Alice" });

      // Assert
      expect(mockPrisma.member.update).not.toHaveBeenCalled();
    });

    it("ควร throw BadRequestException เมื่อ email/phone ซ้ำ (P2002)", async () => {
      // Arrange
      const err = new Prisma.PrismaClientKnownRequestError("Unique constraint", { code: "P2002", clientVersion: "4" });
      mockPrisma.member.create.mockRejectedValue(err);

      // Assert
      await expect(service.create({ fullName: "Alice", email: "dup@test.com" })).rejects.toThrow(BadRequestException);
    });
  });

  // ─── update ────────────────────────────────────────────────────────────────

  describe("update", () => {
    it("ควรอัปเดต fields ได้ถูกต้อง", async () => {
      // Arrange
      mockPrisma.member.findUnique.mockResolvedValue(mockMember);
      mockPrisma.member.update.mockResolvedValue({ ...mockMember, fullName: "Bob" });

      // Act
      await service.update("m1", { fullName: "Bob" });

      // Assert
      expect(mockPrisma.member.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "m1" }, data: expect.objectContaining({ fullName: "Bob" }) }),
      );
    });

    it("ควร throw NotFoundException เมื่อไม่พบ member", async () => {
      // Arrange
      mockPrisma.member.findUnique.mockResolvedValue(null);

      // Assert
      await expect(service.update("not-exist", { fullName: "X" })).rejects.toThrow(NotFoundException);
    });

    it("ควร throw BadRequestException เมื่อ P2002", async () => {
      // Arrange
      mockPrisma.member.findUnique.mockResolvedValue(mockMember);
      const err = new Prisma.PrismaClientKnownRequestError("Unique constraint", { code: "P2002", clientVersion: "4" });
      mockPrisma.member.update.mockRejectedValue(err);

      // Assert
      await expect(service.update("m1", { fullName: "X" })).rejects.toThrow(BadRequestException);
    });
  });

  // ─── updateStatus ──────────────────────────────────────────────────────────

  describe("updateStatus", () => {
    it("ควรอัปเดต isActive ได้ถูกต้อง", async () => {
      // Arrange
      mockPrisma.member.findUnique.mockResolvedValue(mockMember);
      mockPrisma.member.update.mockResolvedValue({ ...mockMember, isActive: false });

      // Act
      await service.updateStatus("m1", false);

      // Assert
      expect(mockPrisma.member.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ isActive: false }) }),
      );
    });

    it("ควร throw เมื่อไม่พบ member", async () => {
      // Arrange
      mockPrisma.member.findUnique.mockResolvedValue(null);

      // Assert
      await expect(service.updateStatus("not-exist", true)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── listAddresses ─────────────────────────────────────────────────────────

  describe("listAddresses", () => {
    it("ควร return addresses ของ member ที่ระบุ", async () => {
      // Arrange
      mockPrisma.member.findUnique.mockResolvedValue(mockMember);
      mockPrisma.memberAddress.findMany.mockResolvedValue([mockAddress]);

      // Act
      const result = await service.listAddresses("m1");

      // Assert
      expect(result).toHaveLength(1);
    });
  });

  // ─── createAddress ─────────────────────────────────────────────────────────

  describe("createAddress", () => {
    const basePayload = { recipient: "Alice", phone: "0812345678", addressLine1: "123 Main St" };

    beforeEach(() => {
      mockPrisma.member.findUnique.mockResolvedValue({ ...mockMember, flowAccountContactId: null });
      mockPrisma.memberAddress.updateMany.mockResolvedValue({});
      mockPrisma.memberAddress.create.mockResolvedValue({ ...mockAddress, isDefault: true });
    });

    it("เมื่อ isDefault=true ควรเรียก updateMany ก่อน แล้วสร้าง address ที่เป็น default", async () => {
      // Arrange
      mockPrisma.memberAddress.count.mockResolvedValue(1);

      // Act
      await service.createAddress("m1", { ...basePayload, isDefault: true });

      // Assert
      expect(mockPrisma.memberAddress.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { memberId: "m1" }, data: { isDefault: false } }),
      );
      const data = mockPrisma.memberAddress.create.mock.calls[0][0].data;
      expect(data.isDefault).toBe(true);
    });

    it("เมื่อเป็น address แรก (count=0) ควรตั้ง isDefault=true อัตโนมัติ", async () => {
      // Arrange
      mockPrisma.memberAddress.count.mockResolvedValue(0);

      // Act
      await service.createAddress("m1", { ...basePayload });

      // Assert
      expect(mockPrisma.memberAddress.updateMany).not.toHaveBeenCalled();
      const data = mockPrisma.memberAddress.create.mock.calls[0][0].data;
      expect(data.isDefault).toBe(true);
    });

    it("เมื่อไม่ใช่ address แรก และไม่ได้ส่ง isDefault ควรสร้างที่ isDefault=false", async () => {
      // Arrange
      mockPrisma.memberAddress.count.mockResolvedValue(2);
      mockPrisma.memberAddress.create.mockResolvedValue({ ...mockAddress, isDefault: false });

      // Act
      await service.createAddress("m1", { ...basePayload });

      // Assert
      const data = mockPrisma.memberAddress.create.mock.calls[0][0].data;
      expect(data.isDefault).toBe(false);
    });

    it("ควร throw NotFoundException เมื่อไม่พบ member", async () => {
      // Arrange
      mockPrisma.member.findUnique.mockResolvedValue(null);

      // Assert
      await expect(service.createAddress("not-exist", basePayload)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── updateAddress ─────────────────────────────────────────────────────────

  describe("updateAddress", () => {
    it("ควรอัปเดต address ได้ถูกต้อง", async () => {
      // Arrange
      mockPrisma.memberAddress.findFirst.mockResolvedValue(mockAddress);
      mockPrisma.memberAddress.update.mockResolvedValue({ ...mockAddress, addressLine1: "456 New St" });
      mockPrisma.member.findUnique.mockResolvedValue({ ...mockMember, flowAccountContactId: null });

      // Act
      await service.updateAddress("m1", "a1", { addressLine1: "456 New St" });

      // Assert
      expect(mockPrisma.memberAddress.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "a1" } }),
      );
    });

    it("เมื่อ isDefault=true ควรเรียก updateMany ก่อน", async () => {
      // Arrange
      mockPrisma.memberAddress.findFirst.mockResolvedValue(mockAddress);
      mockPrisma.memberAddress.updateMany.mockResolvedValue({});
      mockPrisma.memberAddress.update.mockResolvedValue({ ...mockAddress, isDefault: true });
      mockPrisma.member.findUnique.mockResolvedValue({ ...mockMember, flowAccountContactId: null });

      // Act
      await service.updateAddress("m1", "a1", { isDefault: true });

      // Assert
      expect(mockPrisma.memberAddress.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isDefault: false } }),
      );
    });

    it("ควร throw NotFoundException เมื่อไม่พบ address", async () => {
      // Arrange
      mockPrisma.memberAddress.findFirst.mockResolvedValue(null);

      // Assert
      await expect(service.updateAddress("m1", "not-exist", {})).rejects.toThrow(NotFoundException);
    });
  });

  // ─── deleteAddress ─────────────────────────────────────────────────────────

  describe("deleteAddress", () => {
    it("ควรลบ address ที่ไม่ใช่ default ได้ปกติ", async () => {
      // Arrange
      mockPrisma.memberAddress.findFirst.mockResolvedValue({ ...mockAddress, isDefault: false });
      mockPrisma.memberAddress.delete.mockResolvedValue({});

      // Act
      const result = await service.deleteAddress("m1", "a1");

      // Assert
      expect(mockPrisma.memberAddress.delete).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it("เมื่อลบ default address และมี next ควร promote next เป็น default", async () => {
      // Arrange
      mockPrisma.memberAddress.findFirst
        .mockResolvedValueOnce({ ...mockAddress, isDefault: true })  // find the address
        .mockResolvedValueOnce({ id: "a2", memberId: "m1" });        // find next
      mockPrisma.memberAddress.delete.mockResolvedValue({});
      mockPrisma.memberAddress.update.mockResolvedValue({});

      // Act
      await service.deleteAddress("m1", "a1");

      // Assert
      expect(mockPrisma.memberAddress.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "a2" }, data: { isDefault: true } }),
      );
    });

    it("เมื่อลบ default address และไม่มี next ควรไม่ promote", async () => {
      // Arrange
      mockPrisma.memberAddress.findFirst
        .mockResolvedValueOnce({ ...mockAddress, isDefault: true })
        .mockResolvedValueOnce(null); // no next
      mockPrisma.memberAddress.delete.mockResolvedValue({});

      // Act
      await service.deleteAddress("m1", "a1");

      // Assert
      expect(mockPrisma.memberAddress.update).not.toHaveBeenCalled();
    });

    it("ควร throw NotFoundException เมื่อไม่พบ address", async () => {
      // Arrange
      mockPrisma.memberAddress.findFirst.mockResolvedValue(null);

      // Assert
      await expect(service.deleteAddress("m1", "not-exist")).rejects.toThrow(NotFoundException);
    });
  });

  // ─── setDefaultAddress ─────────────────────────────────────────────────────

  describe("setDefaultAddress", () => {
    it("ควรตั้ง isDefault=true และ reset ที่อยู่เดิม", async () => {
      // Arrange
      mockPrisma.memberAddress.findFirst.mockResolvedValue(mockAddress);
      mockPrisma.memberAddress.updateMany.mockResolvedValue({});
      mockPrisma.memberAddress.update.mockResolvedValue({ ...mockAddress, isDefault: true });
      mockPrisma.member.findUnique.mockResolvedValue({ ...mockMember, flowAccountContactId: null });

      // Act
      await service.setDefaultAddress("m1", "a1");

      // Assert
      expect(mockPrisma.memberAddress.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isDefault: false } }),
      );
      expect(mockPrisma.memberAddress.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isDefault: true } }),
      );
    });

    it("ควร throw NotFoundException เมื่อไม่พบ address", async () => {
      // Arrange
      mockPrisma.memberAddress.findFirst.mockResolvedValue(null);

      // Assert
      await expect(service.setDefaultAddress("m1", "not-exist")).rejects.toThrow(NotFoundException);
    });
  });

  // ─── getCreditTransactions ─────────────────────────────────────────────────

  describe("getCreditTransactions", () => {
    it("ควร return transactions ของ member", async () => {
      // Arrange
      mockPrisma.creditTransaction.findMany.mockResolvedValue([{ id: "ct1", memberId: "m1" }]);

      // Act
      const result = await service.getCreditTransactions("m1");

      // Assert
      expect(result).toHaveLength(1);
    });
  });

  // ─── remove ────────────────────────────────────────────────────────────────

  describe("remove", () => {
    it("ควรลบ member ได้ปกติ", async () => {
      // Arrange
      mockPrisma.member.findUnique.mockResolvedValue(mockMember);
      mockPrisma.member.delete.mockResolvedValue(mockMember);

      // Act
      const result = await service.remove("m1");

      // Assert
      expect(mockPrisma.member.delete).toHaveBeenCalledWith({ where: { id: "m1" } });
      expect(result.id).toBe("m1");
    });

    it("ควร throw NotFoundException เมื่อไม่พบ member", async () => {
      // Arrange
      mockPrisma.member.findUnique.mockResolvedValue(null);

      // Assert
      await expect(service.remove("not-exist")).rejects.toThrow(NotFoundException);
    });

    it("ควร throw BadRequestException เมื่อ member มีคำสั่งซื้อ (P2003)", async () => {
      // Arrange
      mockPrisma.member.findUnique.mockResolvedValue(mockMember);
      const err = new Prisma.PrismaClientKnownRequestError("Foreign key constraint", { code: "P2003", clientVersion: "4" });
      mockPrisma.member.delete.mockRejectedValue(err);

      // Assert
      await expect(service.remove("m1")).rejects.toThrow(BadRequestException);
    });
  });
});
