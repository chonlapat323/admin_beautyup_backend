import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { Prisma } from "@prisma/client";
import { RolesService, buildFullPermissions, MENUS } from "./roles.service";
import { PrismaService } from "../prisma/prisma.service";

const mockRole = {
  id: "r1",
  name: "Manager",
  permissions: [],
  isActive: true,
  createdAt: new Date(),
  _count: { admins: 0 },
};

const mockPrisma = {
  role: {
    findMany:  jest.fn(),
    findUnique: jest.fn(),
    create:    jest.fn(),
    update:    jest.fn(),
    delete:    jest.fn(),
    count:     jest.fn(),
  },
  $transaction: jest.fn(),
};

describe("buildFullPermissions", () => {
  it("ควร return permissions ครบทุก menu โดยทุก field เป็น false เมื่อส่ง [] เข้า", () => {
    // Act
    const result = buildFullPermissions([]);

    // Assert
    expect(result).toHaveLength(MENUS.length);
    result.forEach((p) => {
      expect(p.canView).toBe(false);
      expect(p.canEdit).toBe(false);
      expect(p.canDelete).toBe(false);
    });
  });

  it("ควร merge permission บาง menu และ default ที่เหลือเป็น false", () => {
    // Act
    const result = buildFullPermissions([{ menu: "dashboard", canView: true, canEdit: false, canDelete: false }]);

    // Assert
    const dashboard = result.find((p) => p.menu === "dashboard")!;
    expect(dashboard.canView).toBe(true);
    const others = result.filter((p) => p.menu !== "dashboard");
    others.forEach((p) => expect(p.canView).toBe(false));
  });
});

describe("RolesService", () => {
  let service: RolesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<RolesService>(RolesService);
    jest.clearAllMocks();
  });

  // ─── findAll ───────────────────────────────────────────────────────────────

  describe("findAll", () => {
    it("ควร return items และ meta ที่ถูกต้อง", async () => {
      // Arrange
      mockPrisma.$transaction.mockResolvedValue([[mockRole], 1]);

      // Act
      const result = await service.findAll({ page: 1, pageSize: 10 });

      // Assert
      expect(result.items).toHaveLength(1);
      expect(result.meta.totalItems).toBe(1);
    });

    it("ควรส่ง name search เมื่อมี search", async () => {
      // Arrange
      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      // Act
      await service.findAll({ search: "manager", page: 1, pageSize: 10 });

      // Assert
      const where = mockPrisma.role.findMany.mock.calls[0][0].where;
      expect(where.name).toBeDefined();
    });

    it("ควรส่ง isActive=true เมื่อ status=active", async () => {
      // Arrange
      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      // Act
      await service.findAll({ status: "active", page: 1, pageSize: 10 });

      // Assert
      const where = mockPrisma.role.findMany.mock.calls[0][0].where;
      expect(where.isActive).toBe(true);
    });

    it("ควรส่ง isActive=false เมื่อ status=inactive", async () => {
      // Arrange
      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      // Act
      await service.findAll({ status: "inactive", page: 1, pageSize: 10 });

      // Assert
      const where = mockPrisma.role.findMany.mock.calls[0][0].where;
      expect(where.isActive).toBe(false);
    });
  });

  // ─── findOne ───────────────────────────────────────────────────────────────

  describe("findOne", () => {
    it("ควร return role เมื่อพบ", async () => {
      // Arrange
      mockPrisma.role.findUnique.mockResolvedValue(mockRole);

      // Act
      const result = await service.findOne("r1");

      // Assert
      expect(result.id).toBe("r1");
    });

    it("ควร throw NotFoundException เมื่อไม่พบ", async () => {
      // Arrange
      mockPrisma.role.findUnique.mockResolvedValue(null);

      // Assert
      await expect(service.findOne("not-exist")).rejects.toThrow(NotFoundException);
    });
  });

  // ─── create ────────────────────────────────────────────────────────────────

  describe("create", () => {
    it("ควรสร้าง role พร้อม buildFullPermissions", async () => {
      // Arrange
      mockPrisma.role.create.mockResolvedValue(mockRole);

      // Act
      await service.create({ name: "Manager", permissions: [{ menu: "dashboard", canView: true }] });

      // Assert
      const data = mockPrisma.role.create.mock.calls[0][0].data;
      expect(data.name).toBe("Manager");
      expect(Array.isArray(data.permissions)).toBe(true);
      expect(data.permissions).toHaveLength(MENUS.length);
    });

    it("ควร throw BadRequestException เมื่อ name ซ้ำ (P2002)", async () => {
      // Arrange
      const err = new Prisma.PrismaClientKnownRequestError("Unique constraint", { code: "P2002", clientVersion: "4" });
      mockPrisma.role.create.mockRejectedValue(err);

      // Assert
      await expect(service.create({ name: "Dup", permissions: [] })).rejects.toThrow(BadRequestException);
    });
  });

  // ─── update ────────────────────────────────────────────────────────────────

  describe("update", () => {
    it("ควรอัปเดต name ได้ถูกต้อง", async () => {
      // Arrange
      mockPrisma.role.findUnique.mockResolvedValue(mockRole);
      mockPrisma.role.update.mockResolvedValue({ ...mockRole, name: "New Name" });

      // Act
      await service.update("r1", { name: "New Name" });

      // Assert
      const data = mockPrisma.role.update.mock.calls[0][0].data;
      expect(data.name).toBe("New Name");
    });

    it("ควรอัปเดต permissions ด้วย buildFullPermissions", async () => {
      // Arrange
      mockPrisma.role.findUnique.mockResolvedValue(mockRole);
      mockPrisma.role.update.mockResolvedValue(mockRole);

      // Act
      await service.update("r1", { permissions: [{ menu: "orders", canView: true }] });

      // Assert
      const data = mockPrisma.role.update.mock.calls[0][0].data;
      expect(Array.isArray(data.permissions)).toBe(true);
    });

    it("ควร throw NotFoundException เมื่อไม่พบ role", async () => {
      // Arrange
      mockPrisma.role.findUnique.mockResolvedValue(null);

      // Assert
      await expect(service.update("not-exist", { name: "X" })).rejects.toThrow(NotFoundException);
    });

    it("ควร throw BadRequestException เมื่อ name ซ้ำ (P2002)", async () => {
      // Arrange
      mockPrisma.role.findUnique.mockResolvedValue(mockRole);
      const err = new Prisma.PrismaClientKnownRequestError("Unique constraint", { code: "P2002", clientVersion: "4" });
      mockPrisma.role.update.mockRejectedValue(err);

      // Assert
      await expect(service.update("r1", { name: "Dup" })).rejects.toThrow(BadRequestException);
    });
  });

  // ─── updateStatus ──────────────────────────────────────────────────────────

  describe("updateStatus", () => {
    it("ควรอัปเดต isActive ได้ถูกต้อง", async () => {
      // Arrange
      mockPrisma.role.findUnique.mockResolvedValue(mockRole);
      mockPrisma.role.update.mockResolvedValue({ ...mockRole, isActive: false });

      // Act
      await service.updateStatus("r1", false);

      // Assert
      expect(mockPrisma.role.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ isActive: false }) }),
      );
    });

    it("ควร throw NotFoundException เมื่อไม่พบ role", async () => {
      // Arrange
      mockPrisma.role.findUnique.mockResolvedValue(null);

      // Assert
      await expect(service.updateStatus("not-exist", true)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── remove ────────────────────────────────────────────────────────────────

  describe("remove", () => {
    it("ควรลบ role ที่ไม่มี admin ผูกอยู่ได้", async () => {
      // Arrange
      mockPrisma.role.findUnique.mockResolvedValue(mockRole); // _count.admins = 0
      mockPrisma.role.delete.mockResolvedValue(mockRole);

      // Act
      await service.remove("r1");

      // Assert
      expect(mockPrisma.role.delete).toHaveBeenCalledWith({ where: { id: "r1" } });
    });

    it("ควร throw BadRequestException เมื่อ role มี admin ผูกอยู่", async () => {
      // Arrange
      mockPrisma.role.findUnique.mockResolvedValue({ ...mockRole, _count: { admins: 2 } });

      // Assert
      await expect(service.remove("r1")).rejects.toThrow(BadRequestException);
    });

    it("ควร throw NotFoundException เมื่อไม่พบ role", async () => {
      // Arrange
      mockPrisma.role.findUnique.mockResolvedValue(null);

      // Assert
      await expect(service.remove("not-exist")).rejects.toThrow(NotFoundException);
    });
  });

  // ─── getMenus ──────────────────────────────────────────────────────────────

  describe("getMenus", () => {
    it("ควร return MENUS array", () => {
      // Act
      const result = service.getMenus();

      // Assert
      expect(result).toBe(MENUS);
      expect(result.length).toBeGreaterThan(0);
    });
  });
});
