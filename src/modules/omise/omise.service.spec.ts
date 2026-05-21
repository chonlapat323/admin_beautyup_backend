import { Test, TestingModule } from "@nestjs/testing";
import { OmiseService } from "./omise.service";

// ─── helper ────────────────────────────────────────────────────────────────

function mockFetch(data: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: jest.fn().mockResolvedValue(data),
    text: jest.fn().mockResolvedValue(typeof data === "string" ? data : JSON.stringify(data)),
  } as unknown as Response;
}

// ─── suite ─────────────────────────────────────────────────────────────────

describe("OmiseService", () => {
  let service: OmiseService;
  let fetchMock: jest.SpyInstance;

  beforeEach(async () => {
    fetchMock = jest.spyOn(global, "fetch").mockImplementation(jest.fn());

    const module: TestingModule = await Test.createTestingModule({
      providers: [OmiseService],
    }).compile();

    service = module.get<OmiseService>(OmiseService);
    jest.clearAllMocks();
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  // ─── createCharge ─────────────────────────────────────────────────────────

  describe("createCharge", () => {
    it("ควร return charge object เมื่อ API สำเร็จ", async () => {
      // Arrange
      const fakeCharge = { id: "chrg_001", status: "successful", amount: 10000, currency: "thb" };
      fetchMock.mockResolvedValue(mockFetch(fakeCharge, true));

      // Act
      const result = await service.createCharge({ token: "tok_abc", amountTHB: 100, description: "test" });

      // Assert
      expect(result.id).toBe("chrg_001");
      expect(result.status).toBe("successful");
    });

    it("ควรแปลง amountTHB เป็น satangs ถูกต้อง (100 THB = 10000 satangs)", async () => {
      // Arrange
      const fakeCharge = { id: "chrg_001", status: "successful", amount: 10000, currency: "thb" };
      fetchMock.mockResolvedValue(mockFetch(fakeCharge, true));

      // Act
      await service.createCharge({ token: "tok_abc", amountTHB: 100, description: "test" });

      // Assert
      const callBody = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
      expect(callBody.amount).toBe(10000);
    });

    it("ควรแปลง amountTHB ที่มีทศนิยมถูกต้อง (99.99 THB = 9999 satangs)", async () => {
      // Arrange
      const fakeCharge = { id: "chrg_002", status: "successful", amount: 9999, currency: "thb" };
      fetchMock.mockResolvedValue(mockFetch(fakeCharge, true));

      // Act
      await service.createCharge({ token: "tok_abc", amountTHB: 99.99, description: "test" });

      // Assert
      const callBody = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
      expect(callBody.amount).toBe(9999);
    });

    it("ควร throw Error เมื่อ API ตอบกลับ ok = false", async () => {
      // Arrange
      fetchMock.mockResolvedValue(mockFetch({ message: "card_declined" }, false, 402));

      // Assert
      await expect(
        service.createCharge({ token: "tok_bad", amountTHB: 100, description: "test" }),
      ).rejects.toThrow("card_declined");
    });

    it("ควร throw Error พร้อม fallback message เมื่อ API error ไม่มี message field", async () => {
      // Arrange
      fetchMock.mockResolvedValue(mockFetch({}, false, 500));

      // Assert
      await expect(
        service.createCharge({ token: "tok_bad", amountTHB: 100, description: "test" }),
      ).rejects.toThrow("Payment failed");
    });

    it("ควรส่ง currency เป็น thb และ capture เป็น true", async () => {
      // Arrange
      const fakeCharge = { id: "chrg_003", status: "successful", amount: 5000, currency: "thb" };
      fetchMock.mockResolvedValue(mockFetch(fakeCharge, true));

      // Act
      await service.createCharge({ token: "tok_abc", amountTHB: 50, description: "desc" });

      // Assert
      const callBody = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
      expect(callBody.currency).toBe("thb");
      expect(callBody.capture).toBe(true);
    });
  });

  // ─── createPromptPayCharge ────────────────────────────────────────────────

  describe("createPromptPayCharge", () => {
    it("ควร return chargeId, svgContent และ expiresAt เมื่อ API สำเร็จและ QR fetch สำเร็จ", async () => {
      // Arrange
      const fakeSource = { id: "src_promptpay_001" };
      const fakeCharge = {
        id: "chrg_pp_001",
        status: "pending",
        amount: 50000,
        currency: "thb",
        expires_at: "2026-05-21T10:00:00Z",
        source: {
          scannable_code: {
            type: "qr",
            image: { download_uri: "https://cdn.omise.co/qr.svg" },
          },
        },
      };
      const fakeSvg = "<svg>qr</svg>";

      const svgResponse = { ok: true, text: jest.fn().mockResolvedValue(fakeSvg), json: jest.fn() } as unknown as Response;
      fetchMock
        .mockResolvedValueOnce(mockFetch(fakeSource, true))   // sources
        .mockResolvedValueOnce(mockFetch(fakeCharge, true))   // charges
        .mockResolvedValueOnce(svgResponse);                  // image download (returns text)

      // Act
      const result = await service.createPromptPayCharge({ amountTHB: 500, description: "test QR" });

      // Assert
      expect(result.chargeId).toBe("chrg_pp_001");
      expect(result.svgContent).toBe(fakeSvg);
      expect(result.expiresAt).toBe("2026-05-21T10:00:00Z");
    });

    it("ควร return svgContent เป็น string ว่าง เมื่อ QR image fetch ล้มเหลว", async () => {
      // Arrange
      const fakeSource = { id: "src_promptpay_002" };
      const fakeCharge = {
        id: "chrg_pp_002",
        status: "pending",
        amount: 50000,
        currency: "thb",
        expires_at: "2026-05-21T10:00:00Z",
        source: {
          scannable_code: {
            type: "qr",
            image: { download_uri: "https://cdn.omise.co/qr.svg" },
          },
        },
      };
      const failedImgRes = { ok: false, text: jest.fn(), json: jest.fn() } as unknown as Response;

      fetchMock
        .mockResolvedValueOnce(mockFetch(fakeSource, true))
        .mockResolvedValueOnce(mockFetch(fakeCharge, true))
        .mockResolvedValueOnce(failedImgRes);

      // Act
      const result = await service.createPromptPayCharge({ amountTHB: 500, description: "test QR" });

      // Assert
      expect(result.chargeId).toBe("chrg_pp_002");
      expect(result.svgContent).toBe("");
    });

    it("ควร return svgContent เป็น string ว่าง เมื่อไม่มี download_uri", async () => {
      // Arrange
      const fakeSource = { id: "src_promptpay_003" };
      const fakeCharge = {
        id: "chrg_pp_003",
        status: "pending",
        amount: 50000,
        currency: "thb",
        source: { scannable_code: { type: "qr" } }, // ไม่มี image
      };

      fetchMock
        .mockResolvedValueOnce(mockFetch(fakeSource, true))
        .mockResolvedValueOnce(mockFetch(fakeCharge, true));

      // Act
      const result = await service.createPromptPayCharge({ amountTHB: 500, description: "test QR" });

      // Assert
      expect(result.svgContent).toBe("");
    });

    it("ควร throw Error เมื่อ source creation ล้มเหลว", async () => {
      // Arrange
      fetchMock.mockResolvedValueOnce(mockFetch({ message: "invalid_request" }, false, 400));

      // Assert
      await expect(
        service.createPromptPayCharge({ amountTHB: 500, description: "test" }),
      ).rejects.toThrow("invalid_request");
    });

    it("ควร throw Error เมื่อ charge creation ล้มเหลวหลัง source สำเร็จ", async () => {
      // Arrange
      const fakeSource = { id: "src_promptpay_004" };
      fetchMock
        .mockResolvedValueOnce(mockFetch(fakeSource, true))
        .mockResolvedValueOnce(mockFetch({ message: "charge_failed" }, false, 402));

      // Assert
      await expect(
        service.createPromptPayCharge({ amountTHB: 500, description: "test" }),
      ).rejects.toThrow("charge_failed");
    });

    it("ควรใช้ expiresAt fallback เป็น 15 นาทีข้างหน้า เมื่อ charge ไม่มี expires_at", async () => {
      // Arrange
      const beforeTest = Date.now();
      const fakeSource = { id: "src_pp_005" };
      const fakeCharge = {
        id: "chrg_pp_005",
        status: "pending",
        amount: 10000,
        currency: "thb",
        // ไม่มี expires_at
      };

      fetchMock
        .mockResolvedValueOnce(mockFetch(fakeSource, true))
        .mockResolvedValueOnce(mockFetch(fakeCharge, true));

      // Act
      const result = await service.createPromptPayCharge({ amountTHB: 100, description: "test" });

      // Assert
      const expiresAt = new Date(result.expiresAt).getTime();
      expect(expiresAt).toBeGreaterThanOrEqual(beforeTest + 15 * 60 * 1000 - 1000);
      expect(expiresAt).toBeLessThanOrEqual(beforeTest + 15 * 60 * 1000 + 1000);
    });
  });

  // ─── createTrueMoneyCharge ────────────────────────────────────────────────

  describe("createTrueMoneyCharge", () => {
    const baseParams = {
      phoneNumber: "0812345678",
      amountTHB: 200,
      description: "TrueMoney test",
      returnUri: "https://example.com/return",
    };

    it("ควร return chargeId และ authorizeUri เมื่อ API สำเร็จ", async () => {
      // Arrange
      const fakeSource = { id: "src_truemoney_001" };
      const fakeCharge = {
        id: "chrg_tm_001",
        status: "pending",
        amount: 20000,
        currency: "thb",
        authorize_uri: "https://truemoney.com/authorize?ref=abc",
      };

      fetchMock
        .mockResolvedValueOnce(mockFetch(fakeSource, true))
        .mockResolvedValueOnce(mockFetch(fakeCharge, true));

      // Act
      const result = await service.createTrueMoneyCharge(baseParams);

      // Assert
      expect(result.chargeId).toBe("chrg_tm_001");
      expect(result.authorizeUri).toBe("https://truemoney.com/authorize?ref=abc");
    });

    it("ควร return authorizeUri เป็น string ว่าง เมื่อ charge ไม่มี authorize_uri", async () => {
      // Arrange
      const fakeSource = { id: "src_truemoney_002" };
      const fakeCharge = { id: "chrg_tm_002", status: "pending", amount: 20000, currency: "thb" };

      fetchMock
        .mockResolvedValueOnce(mockFetch(fakeSource, true))
        .mockResolvedValueOnce(mockFetch(fakeCharge, true));

      // Act
      const result = await service.createTrueMoneyCharge(baseParams);

      // Assert
      expect(result.authorizeUri).toBe("");
    });

    it("ควร throw Error เมื่อ source creation ล้มเหลว", async () => {
      // Arrange
      fetchMock.mockResolvedValueOnce(mockFetch({ message: "invalid_phone" }, false, 400));

      // Assert
      await expect(service.createTrueMoneyCharge(baseParams)).rejects.toThrow("invalid_phone");
    });

    it("ควร throw Error พร้อม fallback message เมื่อ source error ไม่มี message", async () => {
      // Arrange
      fetchMock.mockResolvedValueOnce(mockFetch({}, false, 500));

      // Assert
      await expect(service.createTrueMoneyCharge(baseParams)).rejects.toThrow(
        "Failed to create TrueMoney source",
      );
    });

    it("ควร throw Error เมื่อ charge creation ล้มเหลวหลัง source สำเร็จ", async () => {
      // Arrange
      const fakeSource = { id: "src_truemoney_003" };
      fetchMock
        .mockResolvedValueOnce(mockFetch(fakeSource, true))
        .mockResolvedValueOnce(mockFetch({ message: "charge_failed" }, false, 402));

      // Assert
      await expect(service.createTrueMoneyCharge(baseParams)).rejects.toThrow("charge_failed");
    });

    it("ควรส่ง phone_number และ type ถูกต้องใน source request", async () => {
      // Arrange
      const fakeSource = { id: "src_tm_004" };
      const fakeCharge = { id: "chrg_tm_004", status: "pending", amount: 20000, currency: "thb" };
      fetchMock
        .mockResolvedValueOnce(mockFetch(fakeSource, true))
        .mockResolvedValueOnce(mockFetch(fakeCharge, true));

      // Act
      await service.createTrueMoneyCharge(baseParams);

      // Assert
      const sourceBody = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
      expect(sourceBody.type).toBe("truemoney");
      expect(sourceBody.phone_number).toBe("0812345678");
    });
  });

  // ─── getCharge ────────────────────────────────────────────────────────────

  describe("getCharge", () => {
    it("ควร return charge object เมื่อ API สำเร็จ", async () => {
      // Arrange
      const fakeCharge = { id: "chrg_001", status: "successful", amount: 10000, currency: "thb" };
      fetchMock.mockResolvedValue(mockFetch(fakeCharge, true));

      // Act
      const result = await service.getCharge("chrg_001");

      // Assert
      expect(result.id).toBe("chrg_001");
      expect(result.status).toBe("successful");
    });

    it("ควร throw Error เมื่อ charge ไม่พบ (API error)", async () => {
      // Arrange
      fetchMock.mockResolvedValue(mockFetch({ message: "not_found" }, false, 404));

      // Assert
      await expect(service.getCharge("chrg_notfound")).rejects.toThrow("not_found");
    });

    it("ควร throw Error พร้อม fallback message เมื่อ API error ไม่มี message", async () => {
      // Arrange
      fetchMock.mockResolvedValue(mockFetch({}, false, 500));

      // Assert
      await expect(service.getCharge("chrg_err")).rejects.toThrow("Failed to get charge");
    });

    it("ควรส่ง GET request ไปที่ URL ที่มี chargeId ถูกต้อง", async () => {
      // Arrange
      const fakeCharge = { id: "chrg_check", status: "pending", amount: 5000, currency: "thb" };
      fetchMock.mockResolvedValue(mockFetch(fakeCharge, true));

      // Act
      await service.getCharge("chrg_check");

      // Assert
      const calledUrl = fetchMock.mock.calls[0][0] as string;
      expect(calledUrl).toContain("chrg_check");
      expect(calledUrl).toContain("/charges/");
    });
  });
});
