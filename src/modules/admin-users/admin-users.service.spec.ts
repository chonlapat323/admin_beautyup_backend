import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { Prisma } from "@prisma/client";
import { createHash } from "crypto";
import { AdminUsersService } from "./admin-users.service";
import { PrismaService } from "../prisma/prisma.service";

function hash(password: string) {
  return createHash("sha256").update(password).digest("hex");
}

const mockUser = {
  id: "u1",
  email: "admin@test.com",
  firstName: "Admin",
  lastName: "User",
  roleId: "r1",
  role: { id: "r1", name: "SuperAdmin" },
  isActive: true,
  storeId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockPrisma = {
  adminUser: {
    findMany:  jest.fn(),
    findUnique: jest.fn(),
    create:    jest.fn(),
    update:    jest.fn(),
    delete:    jest.fn(),
    count:     jest.fn(),
  },
  $transaction: jest.fn(),
};

describe("AdminUsersService", () => {
  let service: AdminUsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminUsersService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AdminUsersService>(AdminUsersService);
    jest.clearAllMocks();
  });

  // ─── findAll ───────────────────────────────────────────────────────────────

  describe("findAll", () => {
    it("ควร return items และ meta ที่ถูกต้อง", async () => {
      // Arrange
      mockPrisma.$transaction.mockResolvedValue([[mockUser], 1]);

      // Act
      const result = await service.findAll({ page: 1, pageSize: 10 });

      // Assert
      expect(result.items).toHaveLength(1);
      expect(result.meta.totalItems).toBe(1);
    });

    it("ควรส่ง OR clause เมื่อมี search", async () => {
      // Arrange
      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      // Act
      await service.findAll({ search: "admin", page: 1, pageSize: 10 });

      // Assert
      const where = mockPrisma.adminUser.findMany.mock.calls[0][0].where;
      expect(where.OR).toBeDefined();
    });

    it("ควรส่ง isActive=true เมื่อ status=active", async () => {
      // Arrange
      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      // Act
      await service.findAll({ status: "active", page: 1, pageSize: 10 });

      // Assert
      const where = mockPrisma.adminUser.findMany.mock.calls[0][0].where;
      expect(where.isActive).toBe(true);
    });

    it("ควรส่ง isActive=false เมื่อ status=inactive", async () => {
      // Arrange
      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      // Act
      await service.findAll({ status: "inactive", page: 1, pageSize: 10 });

      // Assert
      const where = mockPrisma.adminUser.findMany.mock.calls[0][0].where;
      expect(where.isActive).toBe(false);
    });
  });

  // ─── findOne ───────────────────────────────────────────────────────────────

  describe("findOne", () => {
    it("ควร return user เมื่อพบ", async () => {
      // Arrange
      mockPrisma.adminUser.findUnique.mockResolvedValue(mockUser);

      // Act
      const result = await service.findOne("u1");

      // Assert
      expect(result.id).toBe("u1");
    });

    it("ควร throw NotFoundException เมื่อไม่พบ", async () => {
      // Arrange
      mockPrisma.adminUser.findUnique.mockResolvedValue(null);

      // Assert
      await expect(service.findOne("not-exist")).rejects.toThrow(NotFoundException);
    });
  });

  // ─── create ────────────────────────────────────────────────────────────────

  describe("create", () => {
    it("ควร hash password และสร้าง user ด้วย passwordHash", async () => {
      // Arrange
      mockPrisma.adminUser.create.mockResolvedValue(mockUser);

      // Act
      await service.create({ email: "admin@test.com", password: "secret123" });

      // Assert
      const data = mockPrisma.adminUser.create.mock.calls[0][0].data;
      expect(data.passwordHash).toBe(hash("secret123"));
      expect(data.password).toBeUndefined();
    });

    it("ควร throw BadRequestException เมื่อ email ซ้ำ (P2002)", async () => {
      // Arrange
      const err = new Prisma.PrismaClientKnownRequestError("Unique constraint", { code: "P2002", clientVersion: "4" });
      mockPrisma.adminUser.create.mockRejectedValue(err);

      // Assert
      await expect(service.create({ email: "dup@test.com", password: "secret" })).rejects.toThrow(BadRequestException);
    });
  });

  // ─── update ────────────────────────────────────────────────────────────────

  describe("update", () => {
    it("ควรอัปเดต fields ที่ส่งมาได้ถูกต้อง", async () => {
      // Arrange
      mockPrisma.adminUser.findUnique.mockResolvedValue(mockUser);
      mockPrisma.adminUser.update.mockResolvedValue({ ...mockUser, firstName: "NewName" });

      // Act
      await service.update("u1", { firstName: "NewName" });

      // Assert
      expect(mockPrisma.adminUser.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "u1" }, data: expect.objectContaining({ firstName: "NewName" }) }),
      );
    });

    it("ควร hash password ใหม่เมื่อมี payload.password", async () => {
      // Arrange
      mockPrisma.adminUser.findUnique.mockResolvedValue(mockUser);
      mockPrisma.adminUser.update.mockResolvedValue(mockUser);

      // Act
      await service.update("u1", { password: "newpass" });

      // Assert
      const data = mockPrisma.adminUser.update.mock.calls[0][0].data;
      expect(data.passwordHash).toBe(hash("newpass"));
    });

    it("ควรไม่อัปเดต passwordHash เมื่อไม่มี payload.password", async () => {
      // Arrange
      mockPrisma.adminUser.findUnique.mockResolvedValue(mockUser);
      mockPrisma.adminUser.update.mockResolvedValue(mockUser);

      // Act
      await service.update("u1", { firstName: "Test" });

      // Assert
      const data = mockPrisma.adminUser.update.mock.calls[0][0].data;
      expect(data.passwordHash).toBeUndefined();
    });

    it("ควร throw NotFoundException เมื่อไม่พบ user", async () => {
      // Arrange
      mockPrisma.adminUser.findUnique.mockResolvedValue(null);

      // Assert
      await expect(service.update("not-exist", { firstName: "X" })).rejects.toThrow(NotFoundException);
    });

    it("ควร throw BadRequestException เมื่อ email ซ้ำ (P2002)", async () => {
      // Arrange
      mockPrisma.adminUser.findUnique.mockResolvedValue(mockUser);
      const err = new Prisma.PrismaClientKnownRequestError("Unique constraint", { code: "P2002", clientVersion: "4" });
      mockPrisma.adminUser.update.mockRejectedValue(err);

      // Assert
      await expect(service.update("u1", { email: "dup@test.com" })).rejects.toThrow(BadRequestException);
    });
  });

  // ─── updateStatus ──────────────────────────────────────────────────────────

  describe("updateStatus", () => {
    it("ควรอัปเดต isActive ได้ถูกต้อง", async () => {
      // Arrange
      mockPrisma.adminUser.findUnique.mockResolvedValue(mockUser);
      mockPrisma.adminUser.update.mockResolvedValue({ ...mockUser, isActive: false });

      // Act
      await service.updateStatus("u1", false);

      // Assert
      expect(mockPrisma.adminUser.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ isActive: false }) }),
      );
    });

    it("ควร throw NotFoundException เมื่อไม่พบ user", async () => {
      // Arrange
      mockPrisma.adminUser.findUnique.mockResolvedValue(null);

      // Assert
      await expect(service.updateStatus("not-exist", true)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── remove ────────────────────────────────────────────────────────────────

  describe("remove", () => {
    it("ควรลบ user ได้ปกติ", async () => {
      // Arrange
      mockPrisma.adminUser.findUnique.mockResolvedValue(mockUser);
      mockPrisma.adminUser.delete.mockResolvedValue(mockUser);

      // Act
      await service.remove("u1");

      // Assert
      expect(mockPrisma.adminUser.delete).toHaveBeenCalledWith({ where: { id: "u1" } });
    });

    it("ควร throw NotFoundException เมื่อไม่พบ user", async () => {
      // Arrange
      mockPrisma.adminUser.findUnique.mockResolvedValue(null);

      // Assert
      await expect(service.remove("not-exist")).rejects.toThrow(NotFoundException);
    });
  });
});
