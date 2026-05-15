import { BadRequestException, UnauthorizedException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { createHash } from "crypto";
import { MobileService } from "./mobile.service";
import { PrismaService } from "../prisma/prisma.service";
import { CommissionService } from "../commission/commission.service";
import { SalonCodesService } from "../salon-codes/salon-codes.service";
import { FlowAccountService } from "../flowaccount/flowaccount.service";
import { KBankService } from "../kbank/kbank.service";
import { OmiseService } from "../omise/omise.service";
import { SettingsService } from "../settings/settings.service";

function hash(password: string) {
  return createHash("sha256").update(password).digest("hex");
}

const mockMember = {
  id: "m1",
  fullName: "Alice",
  email: "alice@test.com",
  phone: "0812345678",
  memberType: "REGULAR",
  pointBalance: 0,
  creditBalance: 0,
  referralCode: "BU-ABC123",
  bankName: null,
  bankAccountNumber: null,
  bankAccountName: null,
  isActive: true,
  passwordHash: hash("correct-password"),
  flowAccountContactId: null,
};

const mockPrisma = {
  member: {
    findUnique: jest.fn(),
    findFirst:  jest.fn(),
    create:     jest.fn(),
    update:     jest.fn(),
  },
  memberSession: {
    create: jest.fn(),
  },
};

const mockSalonCodes  = { validate: jest.fn(), incrementUsed: jest.fn() };
const mockFlowAccount = { createContact: jest.fn().mockResolvedValue(null) };
const mockCommission  = {};
const mockKBank       = {};
const mockOmise       = {};
const mockSettings    = {};

describe("MobileService — register & login", () => {
  let service: MobileService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MobileService,
        { provide: PrismaService,      useValue: mockPrisma },
        { provide: CommissionService,  useValue: mockCommission },
        { provide: SalonCodesService,  useValue: mockSalonCodes },
        { provide: FlowAccountService, useValue: mockFlowAccount },
        { provide: KBankService,       useValue: mockKBank },
        { provide: OmiseService,       useValue: mockOmise },
        { provide: SettingsService,    useValue: mockSettings },
      ],
    }).compile();

    service = module.get<MobileService>(MobileService);
    jest.resetAllMocks(); // reset ทั้ง calls และ implementations ระหว่าง test

    // default: FlowAccount fire-and-forget ไม่ block test
    mockFlowAccount.createContact.mockResolvedValue(null);
  });

  // ─── register ──────────────────────────────────────────────────────────────

  describe("register", () => {
    it("ควร throw BadRequestException เมื่อไม่มีทั้ง email และ phone", async () => {
      // Assert
      await expect(
        service.register({ fullName: "Alice", password: "pass" }),
      ).rejects.toThrow(BadRequestException);
    });

    it("ควร throw BadRequestException เมื่อ email ซ้ำ", async () => {
      // Arrange
      mockPrisma.member.findUnique.mockResolvedValue(mockMember); // email ซ้ำ

      // Assert
      await expect(
        service.register({ fullName: "Alice", email: "alice@test.com", password: "pass" }),
      ).rejects.toThrow(BadRequestException);
    });

    it("ควร throw BadRequestException เมื่อ phone ซ้ำ", async () => {
      // Arrange — payload มีแค่ phone (ไม่มี email ดังนั้น email check ถูก skip)
      // findUnique call แรกคือ phone check → return existing member
      mockPrisma.member.findUnique.mockResolvedValue(mockMember);

      // Assert
      await expect(
        service.register({ fullName: "Alice", phone: "0812345678", password: "pass" }),
      ).rejects.toThrow(BadRequestException);
    });

    it("ควรสร้าง member สำเร็จและ return { token, member }", async () => {
      // Arrange
      mockPrisma.member.findUnique.mockResolvedValue(null);  // email ไม่ซ้ำ
      mockPrisma.member.findFirst.mockResolvedValue(null);   // makeReferralCode → unique
      mockPrisma.member.create.mockResolvedValue(mockMember);
      mockPrisma.memberSession.create.mockResolvedValue({});

      // Act
      const result = await service.register({ fullName: "Alice", email: "alice@test.com", password: "pass" });

      // Assert
      expect(result.token).toBeDefined();
      expect(result.member.id).toBe("m1");
    });

    it("ควร hash password ก่อนส่ง create", async () => {
      // Arrange
      mockPrisma.member.findUnique.mockResolvedValue(null);
      mockPrisma.member.findFirst.mockResolvedValue(null);
      mockPrisma.member.create.mockResolvedValue(mockMember);
      mockPrisma.memberSession.create.mockResolvedValue({});

      // Act
      await service.register({ fullName: "Alice", email: "alice@test.com", password: "my-password" });

      // Assert
      const data = mockPrisma.member.create.mock.calls[0][0].data;
      expect(data.passwordHash).toBe(hash("my-password"));
      expect(data.password).toBeUndefined();
    });

    it("ควรตั้ง referredById เมื่อพบ referrer จาก referralCode", async () => {
      // Arrange
      mockPrisma.member.findUnique.mockResolvedValue(null);
      mockPrisma.member.findFirst
        .mockResolvedValueOnce({ id: "referrer-1" }) // referrer lookup
        .mockResolvedValueOnce(null);                // makeReferralCode → unique
      mockPrisma.member.create.mockResolvedValue(mockMember);
      mockPrisma.memberSession.create.mockResolvedValue({});

      // Act
      await service.register({ fullName: "Alice", email: "alice@test.com", password: "pass", referralCode: "BU-REF001" });

      // Assert
      const data = mockPrisma.member.create.mock.calls[0][0].data;
      expect(data.referredById).toBe("referrer-1");
    });

    it("ควรไม่ set referredById เมื่อไม่พบ referrer", async () => {
      // Arrange
      mockPrisma.member.findUnique.mockResolvedValue(null);
      mockPrisma.member.findFirst.mockResolvedValue(null); // referrer not found + makeReferralCode unique
      mockPrisma.member.create.mockResolvedValue(mockMember);
      mockPrisma.memberSession.create.mockResolvedValue({});

      // Act
      await service.register({ fullName: "Alice", email: "alice@test.com", password: "pass", referralCode: "NOT-EXIST" });

      // Assert
      const data = mockPrisma.member.create.mock.calls[0][0].data;
      expect(data.referredById).toBeUndefined();
    });

    it("ควร throw BadRequestException เมื่อ salonCode ไม่ถูกต้อง", async () => {
      // Arrange
      mockPrisma.member.findUnique.mockResolvedValue(null);
      mockSalonCodes.validate.mockResolvedValue(null); // invalid code

      // Assert
      await expect(
        service.register({ fullName: "Alice", email: "alice@test.com", password: "pass", salonCode: "INVALID" }),
      ).rejects.toThrow(BadRequestException);
    });

    it("ควรสร้าง member เป็น SALON และ increment salonCode เมื่อ salonCode ถูกต้อง", async () => {
      // Arrange
      mockPrisma.member.findUnique.mockResolvedValue(null);
      mockSalonCodes.validate.mockResolvedValue({ id: "sc1" });
      mockSalonCodes.incrementUsed.mockResolvedValue({});
      mockPrisma.member.findFirst.mockResolvedValue(null); // makeReferralCode
      mockPrisma.member.create.mockResolvedValue({ ...mockMember, memberType: "SALON" });
      mockPrisma.memberSession.create.mockResolvedValue({});

      // Act
      await service.register({ fullName: "Alice", email: "alice@test.com", password: "pass", salonCode: "SALON001" });

      // Assert
      const data = mockPrisma.member.create.mock.calls[0][0].data;
      expect(data.memberType).toBe("SALON");
      expect(data.salonCodeId).toBe("sc1");
      expect(mockSalonCodes.incrementUsed).toHaveBeenCalledWith("sc1");
    });
  });

  // ─── login ─────────────────────────────────────────────────────────────────

  describe("login", () => {
    it("ควร return { token, member } เมื่อ login ด้วย email สำเร็จ", async () => {
      // Arrange
      mockPrisma.member.findUnique.mockResolvedValue(mockMember);
      mockPrisma.memberSession.create.mockResolvedValue({});

      // Act
      const result = await service.login({ identifier: "alice@test.com", password: "correct-password" });

      // Assert
      expect(result.token).toBeDefined();
      expect(result.member.id).toBe("m1");
    });

    it("ควรใช้ findFirst by phone เมื่อ identifier ไม่มี @", async () => {
      // Arrange
      mockPrisma.member.findFirst.mockResolvedValue(mockMember);
      mockPrisma.memberSession.create.mockResolvedValue({});

      // Act
      await service.login({ identifier: "0812345678", password: "correct-password" });

      // Assert
      expect(mockPrisma.member.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { phone: "0812345678" } }),
      );
    });

    it("ควร throw UnauthorizedException เมื่อไม่พบ member", async () => {
      // Arrange
      mockPrisma.member.findUnique.mockResolvedValue(null);

      // Assert
      await expect(service.login({ identifier: "notfound@test.com", password: "pass" })).rejects.toThrow(UnauthorizedException);
    });

    it("ควร throw UnauthorizedException เมื่อ member ไม่ active", async () => {
      // Arrange
      mockPrisma.member.findUnique.mockResolvedValue({ ...mockMember, isActive: false });

      // Assert
      await expect(service.login({ identifier: "alice@test.com", password: "correct-password" })).rejects.toThrow(UnauthorizedException);
    });

    it("ควร throw UnauthorizedException เมื่อ password ไม่ตรง", async () => {
      // Arrange
      mockPrisma.member.findUnique.mockResolvedValue(mockMember);

      // Assert
      await expect(service.login({ identifier: "alice@test.com", password: "wrong-password" })).rejects.toThrow(UnauthorizedException);
    });
  });
});
