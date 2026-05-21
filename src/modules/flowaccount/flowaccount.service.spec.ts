import { Test, TestingModule } from "@nestjs/testing";
import { FlowAccountService } from "./flowaccount.service";

let fetchMock: jest.SpyInstance;

function mockFetchOnce(data: unknown, ok = true, status = 200) {
  fetchMock.mockResolvedValueOnce({
    ok,
    status,
    json: jest.fn().mockResolvedValue(data),
    text: jest.fn().mockResolvedValue(JSON.stringify(data)),
  } as unknown as Response);
}

const mockTokenResponse = {
  access_token: "test-token-123",
  expires_in: 3600,
};

describe("FlowAccountService", () => {
  let service: FlowAccountService;

  beforeEach(async () => {
    fetchMock = jest.spyOn(global, "fetch").mockImplementation(jest.fn());

    const module: TestingModule = await Test.createTestingModule({
      providers: [FlowAccountService],
    }).compile();

    service = module.get<FlowAccountService>(FlowAccountService);
    jest.clearAllMocks();
    // Reset fetch spy after clearAllMocks
    fetchMock = jest.spyOn(global, "fetch").mockImplementation(jest.fn());
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  // ---------------------------------------------------------------------------
  // Token caching
  // ---------------------------------------------------------------------------
  describe("getToken() — token caching", () => {
    it("ควร fetch token ใหม่เมื่อยังไม่มี cache", async () => {
      // Arrange
      mockFetchOnce(mockTokenResponse); // token
      mockFetchOnce({ data: { list: [{ id: 999 }] } }); // createContact payload

      // Act
      await service.createContact({ fullName: "ทดสอบ" });

      // Assert — fetch ถูกเรียก 2 ครั้ง (token + contact)
      expect(fetchMock).toHaveBeenCalledTimes(2);
      const [tokenCall] = fetchMock.mock.calls;
      expect((tokenCall[1] as RequestInit).method).toBe("POST");
      const bodyStr = String((tokenCall[1] as RequestInit).body);
      expect(bodyStr).toContain("grant_type=client_credentials");
    });

    it("ควรใช้ token จาก cache เมื่อเรียก method 2 ครั้งติดกัน — fetch token แค่ครั้งเดียว", async () => {
      // Arrange — mock 4 ครั้ง: token, call1-contact, (no-token-2nd), call2-contact
      mockFetchOnce(mockTokenResponse); // token (ครั้งเดียว)
      mockFetchOnce({ data: { list: [{ id: 1 }] } }); // createContact ครั้งที่ 1
      mockFetchOnce({ data: { list: [{ id: 2 }] } }); // createContact ครั้งที่ 2

      // Act
      await service.createContact({ fullName: "คนที่หนึ่ง" });
      await service.createContact({ fullName: "คนที่สอง" });

      // Assert — fetch เรียก 3 ครั้ง (1 token + 2 contacts), ไม่ใช่ 4 ครั้ง
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it("ควร throw เมื่อ token API ตอบ non-ok", async () => {
      // Arrange — token endpoint ตอบ 401
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: jest.fn().mockResolvedValue("Unauthorized"),
      } as unknown as Response);

      // Act & Assert — createContact จับ exception จาก getToken แล้ว return null
      const result = await service.createContact({ fullName: "ทดสอบ" });
      expect(result).toBeNull();
    });

    it("ควร throw (propagate) เมื่อ fetch token เกิด network error", async () => {
      // Arrange — network error ที่ token fetch
      fetchMock.mockRejectedValueOnce(new Error("Network failure"));

      // Act — createContact จะ catch ใน outer try/catch แล้ว return null
      const result = await service.createContact({ fullName: "ทดสอบ" });

      // Assert
      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // createContact()
  // ---------------------------------------------------------------------------
  describe("createContact()", () => {
    it("สำเร็จ → ควร return contactId (number)", async () => {
      // Arrange
      mockFetchOnce(mockTokenResponse);
      mockFetchOnce({ data: { list: [{ id: 42 }] } });

      // Act
      const result = await service.createContact({ fullName: "สมหญิง มีดี" });

      // Assert
      expect(result).toBe(42);
    });

    it("API ตอบ non-ok → ควร return null (ไม่ throw)", async () => {
      // Arrange
      mockFetchOnce(mockTokenResponse);
      mockFetchOnce({ message: "Bad Request" }, false, 400);

      // Act
      const result = await service.createContact({ fullName: "สมชาย ผิดพลาด" });

      // Assert
      expect(result).toBeNull();
    });

    it("เมื่อ fetch เกิด network error → ควร return null (ไม่ throw)", async () => {
      // Arrange
      mockFetchOnce(mockTokenResponse);
      fetchMock.mockRejectedValueOnce(new Error("ECONNREFUSED"));

      // Act
      const result = await service.createContact({ fullName: "สมศรี เน็ตล่ม" });

      // Assert
      expect(result).toBeNull();
    });

    it("member มี email และ phone → ควรส่งใน payload", async () => {
      // Arrange
      mockFetchOnce(mockTokenResponse);
      mockFetchOnce({ data: { list: [{ id: 55 }] } });

      // Act
      await service.createContact({
        fullName: "มีข้อมูล ครบถ้วน",
        email: "test@email.com",
        phone: "0812345678",
      });

      // Assert
      const contactCall = fetchMock.mock.calls[1];
      const body = JSON.parse((contactCall[1] as RequestInit).body as string);
      expect(body.contactEmail).toBe("test@email.com");
      expect(body.contactMobile).toBe("0812345678");
    });

    it("member ไม่มี email/phone (null) → ควรส่ง '' แทน", async () => {
      // Arrange
      mockFetchOnce(mockTokenResponse);
      mockFetchOnce({ data: { list: [{ id: 56 }] } });

      // Act
      await service.createContact({
        fullName: "ไม่มีข้อมูล",
        email: null,
        phone: null,
      });

      // Assert
      const contactCall = fetchMock.mock.calls[1];
      const body = JSON.parse((contactCall[1] as RequestInit).body as string);
      expect(body.contactEmail).toBe("");
      expect(body.contactMobile).toBe("");
    });

    it("response ไม่มี id ใน list → ควร return null", async () => {
      // Arrange
      mockFetchOnce(mockTokenResponse);
      mockFetchOnce({ data: { list: [] } });

      // Act
      const result = await service.createContact({ fullName: "ว่างเปล่า" });

      // Assert
      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // createItem()
  // ---------------------------------------------------------------------------
  describe("createItem()", () => {
    const baseProduct = {
      sku: "SKU-001",
      name: "สินค้าทดสอบ",
      price: 299,
      stock: 10,
    };

    it("สำเร็จ → ควร return itemId (string)", async () => {
      // Arrange
      mockFetchOnce(mockTokenResponse);
      mockFetchOnce({ data: { list: [{ id: "ITEM-999" }] } });

      // Act
      const result = await service.createItem(baseProduct);

      // Assert
      expect(result).toBe("ITEM-999");
    });

    it("API ตอบ non-ok → ควร return null", async () => {
      // Arrange
      mockFetchOnce(mockTokenResponse);
      mockFetchOnce({ message: "Conflict" }, false, 409);

      // Act
      const result = await service.createItem(baseProduct);

      // Assert
      expect(result).toBeNull();
    });

    it("เมื่อ fetch เกิด network error → ควร return null (ไม่ throw)", async () => {
      // Arrange
      mockFetchOnce(mockTokenResponse);
      fetchMock.mockRejectedValueOnce(new Error("Network error"));

      // Act
      const result = await service.createItem(baseProduct);

      // Assert
      expect(result).toBeNull();
    });

    it("มี categoryName → ควรส่ง categoryName ใน payload", async () => {
      // Arrange
      mockFetchOnce(mockTokenResponse);
      mockFetchOnce({ data: { list: [{ id: "ITEM-100" }] } });

      // Act
      await service.createItem({ ...baseProduct, categoryName: "ของใช้ส่วนตัว" });

      // Assert
      const itemCall = fetchMock.mock.calls[1];
      const body = JSON.parse((itemCall[1] as RequestInit).body as string);
      expect(body.categoryName).toBe("ของใช้ส่วนตัว");
    });

    it("ไม่มี categoryName (null) → ไม่ควรมี key categoryName ใน payload", async () => {
      // Arrange
      mockFetchOnce(mockTokenResponse);
      mockFetchOnce({ data: { list: [{ id: "ITEM-101" }] } });

      // Act
      await service.createItem({ ...baseProduct, categoryName: null });

      // Assert
      const itemCall = fetchMock.mock.calls[1];
      const body = JSON.parse((itemCall[1] as RequestInit).body as string);
      expect(body).not.toHaveProperty("categoryName");
    });
  });

  // ---------------------------------------------------------------------------
  // updateItem()
  // ---------------------------------------------------------------------------
  describe("updateItem()", () => {
    const baseProduct = {
      sku: "SKU-002",
      name: "สินค้าแก้ไข",
      price: 399,
    };

    it("สำเร็จ → ควร return void (ไม่ throw)", async () => {
      // Arrange
      mockFetchOnce(mockTokenResponse);
      mockFetchOnce({ status: true });

      // Act & Assert
      await expect(
        service.updateItem("ITEM-XYZ", baseProduct)
      ).resolves.toBeUndefined();
    });

    it("API ตอบ non-ok → ไม่ throw (log แล้วจบ)", async () => {
      // Arrange
      mockFetchOnce(mockTokenResponse);
      mockFetchOnce({ message: "Not Found" }, false, 404);

      // Act & Assert
      await expect(
        service.updateItem("ITEM-NOT-EXIST", baseProduct)
      ).resolves.toBeUndefined();
    });

    it("เมื่อ fetch เกิด network error → ไม่ throw", async () => {
      // Arrange
      mockFetchOnce(mockTokenResponse);
      fetchMock.mockRejectedValueOnce(new Error("Timeout"));

      // Act & Assert
      await expect(
        service.updateItem("ITEM-XYZ", baseProduct)
      ).resolves.toBeUndefined();
    });

    it("ควร PUT ไปที่ URL ที่มี itemId", async () => {
      // Arrange
      mockFetchOnce(mockTokenResponse);
      mockFetchOnce({ status: true });

      // Act
      await service.updateItem("ITEM-ABC-123", baseProduct);

      // Assert
      const updateCall = fetchMock.mock.calls[1];
      expect(updateCall[0]).toContain("/products/ITEM-ABC-123");
      expect((updateCall[1] as RequestInit).method).toBe("PUT");
    });
  });

  // ---------------------------------------------------------------------------
  // createReceipt()
  // ---------------------------------------------------------------------------
  describe("createReceipt()", () => {
    const baseOrder = {
      orderNumber: "ORD-001",
      orderId: "uuid-111",
      publishedOn: "2026-05-21",
      contactId: 10,
      contactName: "ลูกค้าทดสอบ",
      contactEmail: "customer@test.com",
      contactPhone: "0891234567",
      subtotal: 1000,
      grandTotal: 1000,
      items: [{ name: "สินค้า A", quantity: 1, pricePerUnit: 1000, total: 1000 }],
    };

    const taxInvoiceSuccessResponse = {
      data: { recordId: 777, documentSerial: "TAX2026001" },
    };

    const receiptSuccessResponse = {
      data: { recordId: 888 },
    };

    it("สำเร็จทั้ง 2 steps → ควร return { taxInvoiceId, receiptId }", async () => {
      // Arrange
      mockFetchOnce(mockTokenResponse);
      mockFetchOnce(taxInvoiceSuccessResponse);
      mockFetchOnce(receiptSuccessResponse);

      // Act
      const result = await service.createReceipt(baseOrder);

      // Assert
      expect(result).toEqual({ taxInvoiceId: 777, receiptId: 888 });
    });

    it("Step 1 (tax-invoice) fail → ควร return null", async () => {
      // Arrange
      mockFetchOnce(mockTokenResponse);
      mockFetchOnce({ message: "Error" }, false, 500);

      // Act
      const result = await service.createReceipt(baseOrder);

      // Assert
      expect(result).toBeNull();
    });

    it("Step 1 สำเร็จ แต่ taxInvoiceId (recordId) missing → ควร return null", async () => {
      // Arrange
      mockFetchOnce(mockTokenResponse);
      mockFetchOnce({ data: { documentSerial: "TAX2026001" } }); // ไม่มี recordId

      // Act
      const result = await service.createReceipt(baseOrder);

      // Assert
      expect(result).toBeNull();
    });

    it("Step 1 สำเร็จ แต่ documentSerial missing → ควร return null", async () => {
      // Arrange
      mockFetchOnce(mockTokenResponse);
      mockFetchOnce({ data: { recordId: 777 } }); // ไม่มี documentSerial

      // Act
      const result = await service.createReceipt(baseOrder);

      // Assert
      expect(result).toBeNull();
    });

    it("Step 2 (receipt) fail → ควร return { taxInvoiceId, receiptId: 0 } (partial success)", async () => {
      // Arrange
      mockFetchOnce(mockTokenResponse);
      mockFetchOnce(taxInvoiceSuccessResponse);
      mockFetchOnce({ message: "Payment error" }, false, 422);

      // Act
      const result = await service.createReceipt(baseOrder);

      // Assert
      expect(result).toEqual({ taxInvoiceId: 777, receiptId: 0 });
    });

    it("ควรส่ง taxInvoiceId จาก step 1 ไปใน documentReference ของ step 2", async () => {
      // Arrange
      mockFetchOnce(mockTokenResponse);
      mockFetchOnce(taxInvoiceSuccessResponse);
      mockFetchOnce(receiptSuccessResponse);

      // Act
      await service.createReceipt(baseOrder);

      // Assert — call index 2 คือ receipt POST
      const receiptCall = fetchMock.mock.calls[2];
      const body = JSON.parse((receiptCall[1] as RequestInit).body as string);
      expect(body.documentReference[0].recordId).toBe(777);
      expect(body.documentReference[0].referenceDocumentSerial).toBe("TAX2026001");
    });

    it("เมื่อ network error → ควร return null (ไม่ throw)", async () => {
      // Arrange
      mockFetchOnce(mockTokenResponse);
      fetchMock.mockRejectedValueOnce(new Error("ECONNRESET"));

      // Act
      const result = await service.createReceipt(baseOrder);

      // Assert
      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // getShareLink()
  // ---------------------------------------------------------------------------
  describe("getShareLink()", () => {
    it("type = 'receipt' → ควร POST ไปที่ /receipts/sharedocument", async () => {
      // Arrange
      mockFetchOnce(mockTokenResponse);
      mockFetchOnce({ data: { link: "https://share.flowaccount.com/receipt/abc" } });

      // Act
      await service.getShareLink(100, "receipt");

      // Assert
      const shareCall = fetchMock.mock.calls[1];
      expect(shareCall[0]).toContain("/receipts/sharedocument");
    });

    it("type = 'tax-invoice' → ควร POST ไปที่ /tax-invoices/sharedocument", async () => {
      // Arrange
      mockFetchOnce(mockTokenResponse);
      mockFetchOnce({ data: { link: "https://share.flowaccount.com/invoice/xyz" } });

      // Act
      await service.getShareLink(200, "tax-invoice");

      // Assert
      const shareCall = fetchMock.mock.calls[1];
      expect(shareCall[0]).toContain("/tax-invoices/sharedocument");
    });

    it("สำเร็จ → ควร return link string", async () => {
      // Arrange
      mockFetchOnce(mockTokenResponse);
      mockFetchOnce({ data: { link: "https://share.flowaccount.com/receipt/abc" } });

      // Act
      const result = await service.getShareLink(100, "receipt");

      // Assert
      expect(result).toBe("https://share.flowaccount.com/receipt/abc");
    });

    it("API fail → ควร return null", async () => {
      // Arrange
      mockFetchOnce(mockTokenResponse);
      mockFetchOnce({ message: "Not Found" }, false, 404);

      // Act
      const result = await service.getShareLink(999, "receipt");

      // Assert
      expect(result).toBeNull();
    });

    it("เมื่อ network error → ควร return null (ไม่ throw)", async () => {
      // Arrange
      mockFetchOnce(mockTokenResponse);
      fetchMock.mockRejectedValueOnce(new Error("Connection refused"));

      // Act
      const result = await service.getShareLink(100, "tax-invoice");

      // Assert
      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // updateContactAddress()
  // ---------------------------------------------------------------------------
  describe("updateContactAddress()", () => {
    const baseAddress = {
      addressLine1: "123 ถนนสุขุมวิท",
      addressLine2: "แขวงคลองเตย",
      district: "คลองเตย",
      province: "กรุงเทพมหานคร",
      postalCode: "10110",
    };

    it("สำเร็จ → ควร return void (ไม่ throw)", async () => {
      // Arrange
      mockFetchOnce(mockTokenResponse);
      mockFetchOnce({ status: true });

      // Act & Assert
      await expect(
        service.updateContactAddress(1, "สมใจ ดีมาก", "a@b.com", "0800000001", baseAddress)
      ).resolves.toBeUndefined();
    });

    it("ควร concat address: addressLine1 + addressLine2 + 'อ.district' + 'จ.province'", async () => {
      // Arrange
      mockFetchOnce(mockTokenResponse);
      mockFetchOnce({ status: true });

      // Act
      await service.updateContactAddress(2, "ทดสอบ", null, null, baseAddress);

      // Assert
      const updateCall = fetchMock.mock.calls[1];
      const body = JSON.parse((updateCall[1] as RequestInit).body as string);
      expect(body.contactAddress).toBe(
        "123 ถนนสุขุมวิท แขวงคลองเตย อ.คลองเตย จ.กรุงเทพมหานคร"
      );
    });

    it("address ที่ขาด district/province → ไม่มี 'อ.' 'จ.' ใน result", async () => {
      // Arrange
      mockFetchOnce(mockTokenResponse);
      mockFetchOnce({ status: true });
      const addressNoDistrictProvince = {
        addressLine1: "456 ถนนพหลโยธิน",
        addressLine2: null,
        district: null,
        province: null,
        postalCode: "10400",
      };

      // Act
      await service.updateContactAddress(3, "ทดสอบ2", null, null, addressNoDistrictProvince);

      // Assert
      const updateCall = fetchMock.mock.calls[1];
      const body = JSON.parse((updateCall[1] as RequestInit).body as string);
      expect(body.contactAddress).not.toContain("อ.");
      expect(body.contactAddress).not.toContain("จ.");
      expect(body.contactAddress).toBe("456 ถนนพหลโยธิน");
    });

    it("API fail → ไม่ throw (log แล้วจบ)", async () => {
      // Arrange
      mockFetchOnce(mockTokenResponse);
      mockFetchOnce({ message: "Forbidden" }, false, 403);

      // Act & Assert
      await expect(
        service.updateContactAddress(4, "ทดสอบ3", null, null, baseAddress)
      ).resolves.toBeUndefined();
    });

    it("ควร PUT ไปที่ URL ที่มี contactId", async () => {
      // Arrange
      mockFetchOnce(mockTokenResponse);
      mockFetchOnce({ status: true });

      // Act
      await service.updateContactAddress(77, "ทดสอบ", null, null, baseAddress);

      // Assert
      const updateCall = fetchMock.mock.calls[1];
      expect(updateCall[0]).toContain("/contacts/77");
      expect((updateCall[1] as RequestInit).method).toBe("PUT");
    });

    it("email และ phone เป็น null → ควรส่ง '' ใน payload", async () => {
      // Arrange
      mockFetchOnce(mockTokenResponse);
      mockFetchOnce({ status: true });

      // Act
      await service.updateContactAddress(5, "ไม่มีข้อมูล", null, null, baseAddress);

      // Assert
      const updateCall = fetchMock.mock.calls[1];
      const body = JSON.parse((updateCall[1] as RequestInit).body as string);
      expect(body.contactEmail).toBe("");
      expect(body.contactMobile).toBe("");
    });

    it("เมื่อ network error → ไม่ throw", async () => {
      // Arrange
      mockFetchOnce(mockTokenResponse);
      fetchMock.mockRejectedValueOnce(new Error("Timeout"));

      // Act & Assert
      await expect(
        service.updateContactAddress(6, "ทดสอบ4", null, null, baseAddress)
      ).resolves.toBeUndefined();
    });
  });
});
