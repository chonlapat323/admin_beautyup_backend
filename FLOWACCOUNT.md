# FlowAccount OpenAPI Integration

เอกสารนี้รวบรวมข้อมูล FlowAccount OpenAPI ที่จำเป็นสำหรับการ integrate กับ BeautyUp backend

---

## 1. การสมัครใช้งาน (Register)

1. เข้าไปที่ [flowaccount.com](https://flowaccount.com) → สมัครหรือ login
2. ไปที่ **MyCompany** → **Connection** (หรือ API Access)
3. สร้าง Application → ได้ `client_id` และ `client_secret`
4. เก็บ credentials ไว้ใน `.env` (ห้าม commit)

---

## 2. Authentication

FlowAccount ใช้ **OAuth2 Client Credentials** flow

### ขอ Access Token

```
POST https://openapi.flowaccount.com/v1/token
Content-Type: application/x-www-form-urlencoded
```

**Body:**
```
grant_type=client_credentials
&client_id=YOUR_CLIENT_ID
&client_secret=YOUR_CLIENT_SECRET
&scope=
```

**Response:**
```json
{
  "access_token": "eyJhbGciOi...",
  "token_type": "Bearer",
  "expires_in": 86400
}
```

### ใช้ Token กับทุก Request

```
Authorization: Bearer <access_token>
Content-Type: application/json
```

> Token มีอายุ 24 ชั่วโมง — ควร cache ไว้และ refresh เมื่อหมดอายุ

---

## 3. Base URL

| Environment | URL |
|---|---|
| Production | `https://openapi.flowaccount.com/v1` |

---

## 4. Document Types ที่ใช้ใน BeautyUp

| เอกสาร | Method | Endpoint |
|---|---|---|
| ใบเสนอราคา | POST | `/quotations` |
| ใบแจ้งหนี้ | POST | `/invoices` |
| ใบกำกับภาษี | POST | `/tax-invoices` |
| ใบเสร็จรับเงิน / ใบแจ้งหนี้พร้อมใบเสร็จ | POST | `/cash-invoices` |
| ใบสั่งซื้อ | POST | `/purchases-orders` |

แบบ Inline (ส่วนลด/ภาษีแยกตามรายการ):
- `POST /quotations/inline`
- `POST /cash-invoices/inline`
- ฯลฯ

---

## 5. โครงสร้าง Document (ตัวอย่าง Cash Invoice)

### Simple Document

```json
{
  "contactCode": "C00001",
  "contactName": "Pao Chonlapat",
  "contactAddress": "123 ถนนสุขุมวิท กรุงเทพฯ 10110",
  "contactTaxId": "",
  "contactBranch": "",
  "contactEmail": "pao@example.com",
  "contactMobile": "0812345678",
  "date": "2026-04-21",
  "dueDate": "2026-04-21",
  "productCode": "",
  "language": "TH",
  "includeVat": false,
  "vatType": 3,
  "discountType": 3,
  "discountAmount": 0.00,
  "productItems": [
    {
      "productCode": "SKU001",
      "description": "Keratin Treatment Shampoo 300ml",
      "quantity": 2.0000,
      "unitCode": "EA",
      "unitPrice": 450.0000,
      "discountAmount": 0.00
    }
  ]
}
```

### Inline Document (ส่วนลดและภาษีแยกรายการ)

เพิ่ม field ต่อไปนี้ใน `productItems`:
```json
{
  "discountAmount": 50.00,
  "vatRate": 7
}
```

---

## 6. Field สำคัญ

| Field | Type | หมายเหตุ |
|---|---|---|
| `isVat` | boolean | เปิด/ปิด VAT |
| `isVatInclusive` | boolean | ราคาสินค้ารวม VAT แล้วหรือไม่ |
| `useInlineDiscount` | boolean | ส่วนลดแยกตามรายการสินค้า |
| `useInlineVat` | boolean | VAT แยกตามรายการสินค้า |
| `discountType` | number | 1 = เปอร์เซ็นต์, 3 = จำนวนเงิน |

### ความละเอียด Decimal

| ข้อมูล | Decimal |
|---|---|
| ราคาต่อหน่วย, จำนวน | 4 |
| ส่วนลด, ยอดรวม, VAT | 2 |
| ค่าธรรมเนียม | 4 |

---

## 7. Flow ที่วางแผนสำหรับ BeautyUp

```
User กด Confirm Order
       ↓
BeautyUp Backend สร้าง Order (DB)
       ↓
เรียก FlowAccount API สร้าง Cash Invoice
       ↓
ได้ documentCode กลับมา → เก็บใน Order record
       ↓
User เห็น Order + เลข Invoice
```

---

## 8. Environment Variables ที่ต้องเพิ่ม

```env
FLOWACCOUNT_CLIENT_ID=your_client_id
FLOWACCOUNT_CLIENT_SECRET=your_client_secret
FLOWACCOUNT_BASE_URL=https://openapi.flowaccount.com/v1
```

---

## 9. SDK และ Resources

- **Official Docs:** https://developers.flowaccount.com/tutorial/document-api/
- **GitHub SDK (TypeScript):** https://github.com/flowaccount/flowaccount-openapi-sdk
- **Support:** developer_support@flowaccount.com
- **Phone:** 02-026-8989

---

## 10. สิ่งที่ต้องทำก่อน Implement

- [ ] สมัคร/login FlowAccount → ได้ `client_id` และ `client_secret`
- [ ] เพิ่ม env vars ใน `.env` และ VPS
- [ ] เพิ่ม `flowaccountDocumentCode` field ใน Order model (Prisma)
- [ ] สร้าง `FlowAccountModule` ใน NestJS สำหรับ token management และ document creation
- [ ] เรียก FlowAccount หลัง Order confirm สำเร็จ
