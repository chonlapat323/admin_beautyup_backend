import { Test, TestingModule } from "@nestjs/testing";
import { KBankService } from "./kbank.service";

// ─── helper ────────────────────────────────────────────────────────────────

function mockFetch(data: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: jest.fn().mockResolvedValue(data),
    text: jest.fn().mockResolvedValue(JSON.stringify(data)),
  } as unknown as Response;
}

// ─── suite ─────────────────────────────────────────────────────────────────

describe("KBankService", () => {
  let service: KBankService;
  let fetchMock: jest.SpyInstance;

  const fakeToken = "access_token_abc123";
  const tokenResponse = { access_token: fakeToken, expires_in: 1740 };

  beforeEach(async () => {
    fetchMock = jest.spyOn(global, "fetch").mockImplementation(jest.fn());

    const module: TestingModule = await Test.createTestingModule({
      providers: [KBankService],
    }).compile();

    service = module.get<KBankService>(KBankService);
    jest.clearAllMocks();
    // Reset token cache between tests
    (service as unknown as { tokenCache: null }).tokenCache = null;
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  // ─── getAccessToken ───────────────────────────────────────────────────────

  describe("getAccessToken", () => {
    it("ควรดึง token ใหม่จาก KBank OAuth เมื่อยังไม่มี cache", async () => {
      // Arrange
      fetchMock.mockResolvedValueOnce(mockFetch(tokenResponse, true));

      // Act
      const token = await service.getAccessToken();

      // Assert
      expect(token).toBe(fakeToken);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const calledUrl = fetchMock.mock.calls[0][0] as string;
      expect(calledUrl).toContain("/v2/oauth/token");
    });

    it("ควรใช้ cached token โดยไม่ fetch ใหม่ เมื่อ token ยังไม่หมดอายุ", async () => {
      // Arrange
      fetchMock.mockResolvedValueOnce(mockFetch(tokenResponse, true));
      await service.getAccessToken(); // prime cache

      // Act
      fetchMock.mockClear();
      const token = await service.getAccessToken();

      // Assert
      expect(token).toBe(fakeToken);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("ควร fetch token ใหม่เมื่อ forceRefresh = true แม้มี cache", async () => {
      // Arrange
      const refreshedToken = "refreshed_token_xyz";
      fetchMock
        .mockResolvedValueOnce(mockFetch(tokenResponse, true))
        .mockResolvedValueOnce(mockFetch({ access_token: refreshedToken, expires_in: 1740 }, true));
      await service.getAccessToken(); // prime cache

      // Act
      const token = await service.getAccessToken(true);

      // Assert
      expect(token).toBe(refreshedToken);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("ควร throw Error เมื่อ KBank OAuth ล้มเหลว (ok = false)", async () => {
      // Arrange
      fetchMock.mockResolvedValueOnce(mockFetch({ error: "invalid_client" }, false, 401));

      // Assert
      await expect(service.getAccessToken()).rejects.toThrow("KBank OAuth failed");
    });

    it("ควร throw Error เมื่อ response ไม่มี access_token", async () => {
      // Arrange
      fetchMock.mockResolvedValueOnce(mockFetch({ foo: "bar" }, true));

      // Assert
      await expect(service.getAccessToken()).rejects.toThrow("KBank OAuth failed");
    });

    it("Token cache ที่ยังไม่หมดอายุควรไม่ถูก fetch ใหม่", async () => {
      // Arrange
      fetchMock.mockResolvedValueOnce(mockFetch(tokenResponse, true));
      await service.getAccessToken();

      // Act — เรียกซ้ำหลายครั้ง
      await service.getAccessToken();
      await service.getAccessToken();
      await service.getAccessToken();

      // Assert — fetch ถูกเรียกแค่ครั้งแรกครั้งเดียว
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  // ─── kbankFetch (ผ่าน createPayoutToShopS) ────────────────────────────────

  describe("kbankFetch — retry เมื่อ Invalid Access Token", () => {
    it("ควร retry fetch พร้อม token ใหม่ เมื่อ response มี Invalid Access Token", async () => {
      // Arrange
      const refreshedToken = "new_token_after_retry";
      const invalidTokenResponse = {
        code: "openapi_error",
        message: "Invalid Access Token",
      };
      const successResponse = { partnerBatchID: "BatchS001", status: "SUCCESS" };

      fetchMock
        .mockResolvedValueOnce(mockFetch(tokenResponse, true))                // getAccessToken ครั้งแรก
        .mockResolvedValueOnce(mockFetch(invalidTokenResponse, true))         // payout call → invalid
        .mockResolvedValueOnce(mockFetch({ access_token: refreshedToken, expires_in: 1740 }, true)) // force refresh
        .mockResolvedValueOnce(mockFetch(successResponse, true));             // payout retry

      // Act
      const result = await service.createPayoutToShopS();

      // Assert
      expect(result).toEqual(successResponse);
      // fetch ถูกเรียก 4 ครั้ง: oauth, payout(fail), oauth(refresh), payout(retry)
      expect(fetchMock).toHaveBeenCalledTimes(4);
    });

    it("ควร retry เมื่อ response status เป็น 401", async () => {
      // Arrange
      const refreshedToken = "new_token_401";
      const successResponse = { partnerBatchID: "BatchS001", status: "SUCCESS" };

      fetchMock
        .mockResolvedValueOnce(mockFetch(tokenResponse, true))                            // oauth
        .mockResolvedValueOnce(mockFetch({ message: "Unauthorized" }, false, 401))        // 401
        .mockResolvedValueOnce(mockFetch({ access_token: refreshedToken, expires_in: 1740 }, true)) // refresh
        .mockResolvedValueOnce(mockFetch(successResponse, true));                          // retry

      // Act
      const result = await service.createPayoutToShopS();

      // Assert
      expect(result).toEqual(successResponse);
    });
  });

  // ─── inquirePayment ───────────────────────────────────────────────────────

  describe("inquirePayment", () => {
    it("ควร return status ที่ได้จาก API เมื่อ ok = true", async () => {
      // Arrange
      fetchMock
        .mockResolvedValueOnce(mockFetch(tokenResponse, true))
        .mockResolvedValueOnce(mockFetch({ paymentStatus: "success", status: "paid" }, true));

      // Act
      const result = await service.inquirePayment("PAYMENT001");

      // Assert
      expect(result.status).toBe("SUCCESS");
    });

    it("ควร return status PENDING เมื่อ API ตอบ ok = false", async () => {
      // Arrange
      fetchMock
        .mockResolvedValueOnce(mockFetch(tokenResponse, true))
        .mockResolvedValueOnce(mockFetch({ message: "not found" }, false, 404));

      // Act
      const result = await service.inquirePayment("PAYMENT_NOT_FOUND");

      // Assert
      expect(result.status).toBe("PENDING");
    });

    it("ควร return status PENDING เมื่อ API ไม่มี paymentStatus หรือ status", async () => {
      // Arrange
      fetchMock
        .mockResolvedValueOnce(mockFetch(tokenResponse, true))
        .mockResolvedValueOnce(mockFetch({}, true));

      // Act
      const result = await service.inquirePayment("PAYMENT_EMPTY");

      // Assert
      expect(result.status).toBe("PENDING");
    });

    it("ควรแปลง status เป็น uppercase เสมอ", async () => {
      // Arrange
      fetchMock
        .mockResolvedValueOnce(mockFetch(tokenResponse, true))
        .mockResolvedValueOnce(mockFetch({ status: "successful" }, true));

      // Act
      const result = await service.inquirePayment("PAYMENT002");

      // Assert
      expect(result.status).toBe("SUCCESSFUL");
    });
  });

  // ─── createQRPayment ──────────────────────────────────────────────────────

  describe("createQRPayment", () => {
    it("ควร return qrImage, partnerOrderID และ partnerPaymentID เมื่อ API สำเร็จ", async () => {
      // Arrange
      const qrResponse = { qrImage: "base64qrdata==", status: "pending" };
      fetchMock
        .mockResolvedValueOnce(mockFetch(tokenResponse, true))
        .mockResolvedValueOnce(mockFetch(qrResponse, true));

      // Act
      const result = await service.createQRPayment(1000.5);

      // Assert
      expect(result.qrImage).toBe("base64qrdata==");
      expect(result.partnerOrderID).toBeDefined();
      expect(result.partnerPaymentID).toBeDefined();
    });

    it("ควร return qrImage จาก qrCode field เมื่อไม่มี qrImage field", async () => {
      // Arrange
      const qrResponse = { qrCode: "qrcode_data" };
      fetchMock
        .mockResolvedValueOnce(mockFetch(tokenResponse, true))
        .mockResolvedValueOnce(mockFetch(qrResponse, true));

      // Act
      const result = await service.createQRPayment(500);

      // Assert
      expect(result.qrImage).toBe("qrcode_data");
    });

    it("ควร throw Error เมื่อ API ตอบ ok = false", async () => {
      // Arrange
      fetchMock
        .mockResolvedValueOnce(mockFetch(tokenResponse, true))
        .mockResolvedValueOnce(mockFetch({ message: "qr_failed" }, false, 400));

      // Assert
      await expect(service.createQRPayment(1000)).rejects.toThrow("qr_failed");
    });

    it("ควร throw Error พร้อม fallback message เมื่อ API error ไม่มี message", async () => {
      // Arrange
      fetchMock
        .mockResolvedValueOnce(mockFetch(tokenResponse, true))
        .mockResolvedValueOnce(mockFetch({}, false, 500));

      // Assert
      await expect(service.createQRPayment(1000)).rejects.toThrow("KBank QR payment creation failed");
    });
  });

  // ─── createCardPayment ────────────────────────────────────────────────────

  describe("createCardPayment", () => {
    it("ควร return redirectURL, partnerOrderID และ partnerPaymentID เมื่อ API สำเร็จ", async () => {
      // Arrange
      const cardResponse = { redirectURL: "https://pg.kbank.co.th/pay?ref=123" };
      fetchMock
        .mockResolvedValueOnce(mockFetch(tokenResponse, true))
        .mockResolvedValueOnce(mockFetch(cardResponse, true));

      // Act
      const result = await service.createCardPayment(250);

      // Assert
      expect(result.redirectURL).toBe("https://pg.kbank.co.th/pay?ref=123");
      expect(result.partnerOrderID).toBeDefined();
      expect(result.partnerPaymentID).toBeDefined();
    });

    it("ควร return redirectURL จาก webPaymentURL เมื่อไม่มี redirectURL field", async () => {
      // Arrange
      const cardResponse = { webPaymentURL: "https://pg.kbank.co.th/web?ref=456" };
      fetchMock
        .mockResolvedValueOnce(mockFetch(tokenResponse, true))
        .mockResolvedValueOnce(mockFetch(cardResponse, true));

      // Act
      const result = await service.createCardPayment(250);

      // Assert
      expect(result.redirectURL).toBe("https://pg.kbank.co.th/web?ref=456");
    });

    it("ควร throw Error เมื่อ API ตอบ ok = false", async () => {
      // Arrange
      fetchMock
        .mockResolvedValueOnce(mockFetch(tokenResponse, true))
        .mockResolvedValueOnce(mockFetch({ message: "card_error" }, false, 400));

      // Assert
      await expect(service.createCardPayment(250)).rejects.toThrow("card_error");
    });

    it("ควร throw Error พร้อม fallback message เมื่อ API error ไม่มี message", async () => {
      // Arrange
      fetchMock
        .mockResolvedValueOnce(mockFetch(tokenResponse, true))
        .mockResolvedValueOnce(mockFetch({}, false, 500));

      // Assert
      await expect(service.createCardPayment(250)).rejects.toThrow("KBank card payment creation failed");
    });

    it("ควรส่ง amount ในรูปแบบ toFixed(2) ถูกต้อง", async () => {
      // Arrange
      fetchMock
        .mockResolvedValueOnce(mockFetch(tokenResponse, true))
        .mockResolvedValueOnce(mockFetch({ redirectURL: "https://pg.kbank.co.th/pay" }, true));

      // Act
      await service.createCardPayment(99.9);

      // Assert
      const cardBody = JSON.parse((fetchMock.mock.calls[1][1] as RequestInit).body as string);
      expect(cardBody.amount).toBe("99.90");
    });
  });

  // ─── createKPlusPayment ───────────────────────────────────────────────────

  describe("createKPlusPayment", () => {
    it("ควร return deepLink, partnerOrderID และ partnerPaymentID เมื่อ API สำเร็จ", async () => {
      // Arrange
      const kplusResponse = { deepLink: "kplus://pay?ref=kplus123" };
      fetchMock
        .mockResolvedValueOnce(mockFetch(tokenResponse, true))
        .mockResolvedValueOnce(mockFetch(kplusResponse, true));

      // Act
      const result = await service.createKPlusPayment(500);

      // Assert
      expect(result.deepLink).toBe("kplus://pay?ref=kplus123");
      expect(result.partnerOrderID).toBeDefined();
      expect(result.partnerPaymentID).toBeDefined();
    });

    it("ควร return deepLink จาก redirectURL เมื่อไม่มี deepLink field", async () => {
      // Arrange
      const kplusResponse = { redirectURL: "https://kplus.kasikorn.com/redirect" };
      fetchMock
        .mockResolvedValueOnce(mockFetch(tokenResponse, true))
        .mockResolvedValueOnce(mockFetch(kplusResponse, true));

      // Act
      const result = await service.createKPlusPayment(500);

      // Assert
      expect(result.deepLink).toBe("https://kplus.kasikorn.com/redirect");
    });

    it("ควร throw Error เมื่อ API ตอบ ok = false", async () => {
      // Arrange
      fetchMock
        .mockResolvedValueOnce(mockFetch(tokenResponse, true))
        .mockResolvedValueOnce(mockFetch({ message: "kplus_error" }, false, 400));

      // Assert
      await expect(service.createKPlusPayment(500)).rejects.toThrow("kplus_error");
    });

    it("ควร throw Error พร้อม fallback message เมื่อ API error ไม่มี message", async () => {
      // Arrange
      fetchMock
        .mockResolvedValueOnce(mockFetch(tokenResponse, true))
        .mockResolvedValueOnce(mockFetch({}, false, 500));

      // Assert
      await expect(service.createKPlusPayment(500)).rejects.toThrow("KBank payment creation failed");
    });
  });

  // ─── createPayoutToShopS ──────────────────────────────────────────────────

  describe("createPayoutToShopS", () => {
    it("ควร return response data เมื่อ KBank payout สำเร็จ", async () => {
      // Arrange
      const payoutResponse = { partnerBatchID: "BatchS001", status: "SUCCESS" };
      fetchMock
        .mockResolvedValueOnce(mockFetch(tokenResponse, true))   // getAccessToken
        .mockResolvedValueOnce(mockFetch(payoutResponse, true)); // payout

      // Act
      const result = await service.createPayoutToShopS();

      // Assert
      expect(result).toEqual(payoutResponse);
    });

    it("ควร throw Error เมื่อ KBank ตอบ code = openapi_error", async () => {
      // Arrange
      const errorResponse = {
        code: "openapi_error",
        message: "payout_error_msg",
        error: { name: "OTHER", message: "payout_error_msg" },
      };
      fetchMock
        .mockResolvedValueOnce(mockFetch(tokenResponse, true))
        .mockResolvedValueOnce(mockFetch(errorResponse, true));

      // Assert
      await expect(service.createPayoutToShopS()).rejects.toThrow("payout_error_msg");
    });

    it("ควร throw Error เมื่อ KBank ตอบ error.name = BAD_REQUEST", async () => {
      // Arrange
      const errorResponse = {
        error: { name: "BAD_REQUEST", message: "bad_request_detail" },
      };
      fetchMock
        .mockResolvedValueOnce(mockFetch(tokenResponse, true))
        .mockResolvedValueOnce(mockFetch(errorResponse, true));

      // Assert
      await expect(service.createPayoutToShopS()).rejects.toThrow("bad_request_detail");
    });

    it("ควร throw Error พร้อม fallback message เมื่อ error ไม่มี message", async () => {
      // Arrange
      const errorResponse = { code: "openapi_error" };
      fetchMock
        .mockResolvedValueOnce(mockFetch(tokenResponse, true))
        .mockResolvedValueOnce(mockFetch(errorResponse, true));

      // Assert
      await expect(service.createPayoutToShopS()).rejects.toThrow(
        "KBank payout to shop (S) failed",
      );
    });
  });
});
