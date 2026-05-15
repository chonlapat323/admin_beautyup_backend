import { UnauthorizedException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { createHash } from "crypto";
import { AuthService } from "./auth.service";
import { PrismaService } from "../prisma/prisma.service";

function hash(password: string) {
  return createHash("sha256").update(password).digest("hex");
}

const mockPrisma = {
  adminUser: { findUnique: jest.fn() },
};

const mockUser = {
  id: "u1",
  email: "admin@test.com",
  passwordHash: hash("correct-password"),
  isActive: true,
  roleId: "r1",
  role: { id: "r1", name: "SuperAdmin" },
};

describe("AuthService", () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  // ─── login ─────────────────────────────────────────────────────────────────

  describe("login", () => {
    it("ควร return accessToken และ admin info เมื่อ credentials ถูกต้อง", async () => {
      // Arrange
      mockPrisma.adminUser.findUnique.mockResolvedValue(mockUser);

      // Act
      const result = await service.login({ email: "admin@test.com", password: "correct-password" });

      // Assert
      expect(result.accessToken).toBe(`token-${mockUser.id}`);
      expect(result.admin.id).toBe("u1");
      expect(result.admin.email).toBe("admin@test.com");
      expect(result.admin.role).toBe("SuperAdmin");
    });

    it("ควร throw UnauthorizedException เมื่อไม่พบ user", async () => {
      // Arrange
      mockPrisma.adminUser.findUnique.mockResolvedValue(null);

      // Assert
      await expect(service.login({ email: "not@exist.com", password: "x" })).rejects.toThrow(UnauthorizedException);
    });

    it("ควร throw UnauthorizedException เมื่อ user ไม่ active", async () => {
      // Arrange
      mockPrisma.adminUser.findUnique.mockResolvedValue({ ...mockUser, isActive: false });

      // Assert
      await expect(service.login({ email: "admin@test.com", password: "correct-password" })).rejects.toThrow(UnauthorizedException);
    });

    it("ควร throw UnauthorizedException เมื่อ password ไม่ตรง", async () => {
      // Arrange
      mockPrisma.adminUser.findUnique.mockResolvedValue(mockUser);

      // Assert
      await expect(service.login({ email: "admin@test.com", password: "wrong-password" })).rejects.toThrow(UnauthorizedException);
    });

    it("ควร return role='ไม่ระบุ' เมื่อ user ไม่มี role", async () => {
      // Arrange
      mockPrisma.adminUser.findUnique.mockResolvedValue({ ...mockUser, role: null, roleId: null });

      // Act
      const result = await service.login({ email: "admin@test.com", password: "correct-password" });

      // Assert
      expect(result.admin.role).toBe("ไม่ระบุ");
    });
  });

  // ─── forgotPassword ────────────────────────────────────────────────────────

  describe("forgotPassword", () => {
    it("ควร return message พร้อม email ที่ส่งมา", () => {
      // Act
      const result = service.forgotPassword({ email: "admin@test.com" });

      // Assert
      expect(result.message).toContain("admin@test.com");
    });
  });

  // ─── resetPassword ─────────────────────────────────────────────────────────

  describe("resetPassword", () => {
    it("ควร return message", () => {
      // Act
      const result = service.resetPassword();

      // Assert
      expect(result.message).toBeDefined();
    });
  });

  // ─── profile ───────────────────────────────────────────────────────────────

  describe("profile", () => {
    it("ควร return profile object พร้อม id, email, role, storeId", () => {
      // Act
      const result = service.profile();

      // Assert
      expect(result.id).toBeDefined();
      expect(result.email).toBeDefined();
      expect(result.role).toBeDefined();
      expect(result.storeId).toBeDefined();
    });
  });
});
