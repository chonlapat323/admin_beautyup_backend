# FlowAccount OpenAPI — Complete Integration Guide

> **Base URL Production:** `https://openapi.flowaccount.com/v1`  
> **Base URL Sandbox:** `https://openapi.flowaccount.com/test`  
> **Developer Docs:** https://developers.flowaccount.com/tutorial/

---

## สารบัญ

1. [การสมัครและรับ Credentials](#1-การสมัครและรับ-credentials)
2. [Authentication — ขอ Token](#2-authentication--ขอ-token)
3. [Contact API — สร้างลูกค้า](#3-contact-api--สร้างลูกค้า)
4. [Product API — สร้างสินค้า](#4-product-api--สร้างสินค้า)
5. [Document API — สร้างเอกสาร](#5-document-api--สร้างเอกสาร)
6. [Payment — รับชำระเงิน](#6-payment--รับชำระเงิน)
7. [VAT และการคำนวณ](#7-vat-และการคำนวณ)
8. [Flow สำหรับ BeautyUp](#8-flow-สำหรับ-beautyup)
9. [Environment Variables](#9-environment-variables)
10. [Checklist ก่อน Implement](#10-checklist-ก่อน-implement)

---

## 1. การสมัครและรับ Credentials

### สำหรับธุรกิจทั่วไป (Client Credentials Flow)
1. สมัคร/login ที่ [flowaccount.com](https://flowaccount.com)
2. กรอกแบบฟอร์มขอ OpenAPI access ที่ flowaccount.com/developers
3. รอ **1–2 วันทำการ** → ได้ sandbox account + credentials ทดสอบ 30 วัน
4. ทดสอบใน sandbox → แจ้ง staff ขอ production credentials (รอ 3 วันทำการ)

### Environments

| | Website | API Endpoint |
|---|---|---|
| **Production** | https://www.flowaccount.com | https://openapi.flowaccount.com/v1 |
| **Sandbox** | http://sandbox-new.flowaccount.com | https://openapi.flowaccount.com/test |

### Postman Collection
https://www.getpostman.com/collections/01e7c68d7093e2092a64

---

## 2. Authentication — ขอ Token

### ขอ Access Token

```
POST /token
Content-Type: application/x-www-form-urlencoded
```

```
grant_type=client_credentials&client_id=YOUR_CLIENT_ID&client_secret=YOUR_CLIENT_SECRET
```

**Response:**
```json
{
  "access_token": "eyJhbGciOi...",
  "token_type": "Bearer",
  "expires_in": 86400
}
```

> Token มีอายุ **24 ชั่วโมง** — cache ไว้และ refresh เมื่อหมดอายุ

### ใช้ Token กับทุก Request

```
Authorization: Bearer <access_token>
Content-Type: application/json
```

---

## 3. Contact API — สร้างลูกค้า

Contact คือข้อมูลลูกค้า/ผู้ติดต่อที่ผูกกับเอกสาร เมื่อ user register บน BeautyUp → สร้าง Contact ใน FlowAccount

### สร้าง Contact

```
POST /contacts
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "contactName": "Pao Chonlapat",
  "contactCode": "C00001",
  "contactAddress": "123 ถนนสุขุมวิท กรุงเทพฯ 10110",
  "contactTaxId": "",
  "contactBranch": "สำนักงานใหญ่",
  "contactPerson": "Pao Chonlapat",
  "contactEmail": "pao@example.com",
  "contactMobile": "0812345678",
  "contactZipCode": "10110",
  "contactGroup": ""
}
```

### การใช้ Contact ในเอกสาร (ตั้งแต่ Jan 20, 2026)

| กรณี | พฤติกรรม |
|---|---|
| ระบุ `contactId` | ใช้ contact นั้น (ข้าม contactName) |
| ระบุแค่ `contactName` | ถ้ามีชื่อนี้อยู่แล้ว → ใช้เลย, ถ้าไม่มี → สร้างใหม่ |
| ระบุทั้งคู่ | `contactName` ต้องตรงกับ `contactId` |

### Fields ที่ใช้ใน Document

`contactId`, `contactName`, `contactCode`, `contactAddress`, `contactTaxId`,
`contactBranch`, `contactPerson`, `contactEmail`, `contactNumber`, `contactZipCode`, `contactGroup`

---

## 4. Product API — สร้างสินค้า

### ประเภทสินค้า

| type | ประเภท | หมายเหตุ |
|---|---|---|
| `1` | Service | บริการ |
| `3` | Non-Inventory | สินค้าไม่นับสต็อก |
| `5` | Inventory | สินค้านับสต็อก |

> BeautyUp ควรใช้ **type 3 (Non-Inventory)** หรือ **type 5 (Inventory)** สำหรับสินค้าทั่วไป

### Endpoints

| Method | Endpoint | คำอธิบาย |
|---|---|---|
| POST | `/product-masters` | สร้างสินค้า |
| PUT | `/product-masters/{id}` | แก้ไขสินค้า |
| GET | `/product-masters` | ดึงรายการสินค้า |
| DELETE | `/product-masters/{id}` | ลบสินค้า |

### ต้องสร้าง Category ก่อนไหม?

**ไม่ต้อง** — ใช้ `categoryName` เป็น string ธรรมดาได้เลย ถ้า category ยังไม่มีจะสร้างให้อัตโนมัติ

### Request Body — สร้างสินค้า (Non-Inventory)

```json
{
  "type": 3,
  "name": "Keratin Treatment Shampoo 300ml",
  "code": "SKU001",
  "categoryName": "Shampoo",
  "productLists": [
    {
      "unitName": "ชิ้น",
      "sellPrice": 450.0000,
      "buyPrice": 200.0000,
      "barcode": "1234567890123",
      "isMainProduct": true,
      "convertRatio": 1,
      "sellSettings": {
        "vatType": 3,
        "description": "",
        "chartOfAccountId": null
      },
      "buySettings": {
        "vatType": 3,
        "description": "",
        "chartOfAccountId": null
      }
    }
  ]
}
```

### ข้อจำกัด

- ไม่สามารถเปลี่ยน `type` ได้หลังสร้าง
- Inventory ที่มีการเคลื่อนไหวแล้ว — ลบไม่ได้
- Multi-unit: primary unit ต้องมี `isMainProduct: true` และ `convertRatio: 1`

### Default Chart of Accounts

| ประเภท | ขาย (sell) | ซื้อ (buy) |
|---|---|---|
| Service | 41210 | — |
| Non-Inventory | 41110 | 51111.01 |

---

## 5. Document API — สร้างเอกสาร

### ประเภทเอกสาร (documentType)

**ฝั่งขาย (Revenue):**

| เอกสาร | Code | documentType |
|---|---|---|
| ใบเสนอราคา | QT | 3 |
| ใบวางบิล | BL | 5 |
| ใบกำกับภาษี | INV | 7 |
| ใบเสร็จรับเงิน | RE | 9 |
| ใบเสร็จ/ใบกำกับ (Cash Invoice) | CA | 35 |

**ฝั่งซื้อ (Expense):**

| เอกสาร | Code | documentType |
|---|---|---|
| ใบสั่งซื้อ | PO | 1 |
| ใบรับสินค้า | RI | 23 |

### Endpoints เอกสารขาย

| Method | Endpoint | คำอธิบาย |
|---|---|---|
| POST | `/quotations` | ใบเสนอราคา (Simple) |
| POST | `/quotations/inline` | ใบเสนอราคา (Inline) |
| POST | `/tax-invoices` | ใบกำกับภาษี (Simple) |
| POST | `/tax-invoices/inline` | ใบกำกับภาษี (Inline) |
| POST | `/cash-invoices` | ใบเสร็จ/ใบกำกับ (Simple) |
| POST | `/cash-invoices/inline` | ใบเสร็จ/ใบกำกับ (Inline) |
| POST | `/receipts` | ใบเสร็จรับเงิน |

### Request Body — Cash Invoice (เหมาะกับ e-commerce)

```json
{
  "contactName": "Pao Chonlapat",
  "contactEmail": "pao@example.com",
  "contactMobile": "0812345678",
  "contactAddress": "123 ถนนสุขุมวิท กรุงเทพฯ 10110",
  "publishedOn": "2026-04-21",
  "creditType": 3,
  "language": "TH",
  "isVat": false,
  "isVatInclusive": false,
  "discountType": 3,
  "discountAmount": 0.00,
  "productItems": [
    {
      "productCode": "SKU001",
      "description": "Keratin Treatment Shampoo 300ml",
      "quantity": 2.0000,
      "unitName": "ชิ้น",
      "pricePerUnit": 450.0000,
      "discountAmount": 0.00
    }
  ]
}
```

**Response จะได้กลับ:**
```json
{
  "id": 123456,
  "documentSerial": "CA2604-00001",
  "grandTotal": 900.00,
  "status": 9
}
```

### Configuration Fields

| Field | Type | ความหมาย |
|---|---|---|
| `isVat` | boolean | เปิด/ปิด VAT |
| `isVatInclusive` | boolean | ราคารวม VAT แล้วหรือไม่ |
| `isManualVat` | boolean | กำหนด VAT เองแบบ manual |
| `useInlineDiscount` | boolean | ส่วนลดแยกตามรายการ |
| `useInlineVat` | boolean | VAT แยกตามรายการ |
| `discountType` | number | 1=%, 3=฿ |

### Decimal Precision

| ข้อมูล | ทศนิยม |
|---|---|
| `pricePerUnit`, `quantity` | 4 |
| `discountAmount`, `grandTotal`, `vatAmount` | 2 |

---

## 6. Payment — รับชำระเงิน

### Partial Receipt (รับชำระบางส่วน)

ใช้เมื่อลูกค้าจ่ายเงินบางส่วนจากใบกำกับภาษี (Invoice)

```
POST /receipts
```

```json
{
  "isBatchDocument": true,
  "partialPaymentMethod": 11,
  "creditType": 3,
  "grandTotal": 450.00,
  "productItems": [
    {
      "documentId": 123456,
      "documentType": 7,
      "partialAmount": 450.00
    }
  ],
  "documentReference": []
}
```

### Invoice Status Flow

```
สร้าง Invoice → Pending
    ↓ รับชำระบางส่วน
Partial Payment (status=11)
    ↓ รับชำระครบ
Receipt Issued (status=9)
```

### Update Partial Receipt

```
PUT /receipts/{id}
```

body เหมือน POST แต่เพิ่ม `documentStructureType: "UpdateSimpleDocument"`

---

## 7. VAT และการคำนวณ

| vatType | ความหมาย | Input 100 | ผลลัพธ์ |
|---|---|---|---|
| 1 | ราคารวม VAT | 100 | ราคาก่อน VAT = 93.46, VAT = 6.54 |
| 3 | ราคาไม่รวม VAT | 100 | ยอดรวม = 107 |
| 5 | ไม่คิด VAT | 100 | 100 |
| 7 | ยกเว้น VAT | 100 | 100 |

---

## 8. Flow สำหรับ BeautyUp

### ลูกค้าสมัครใหม่

```
User Register บน BeautyUp
    ↓
บันทึก User ใน BeautyUp DB
    ↓
POST /contacts → สร้าง Contact ใน FlowAccount
    ↓
เก็บ flowAccountContactId ใน User record
```

### ลูกค้าสั่งซื้อ

```
User กด Confirm Order
    ↓
สร้าง Order ใน BeautyUp DB
    ↓
POST /cash-invoices → สร้างเอกสารใน FlowAccount
    ↓
ได้ documentSerial + documentId กลับมา
    ↓
เก็บ flowAccountDocumentId + documentSerial ใน Order record
    ↓
User เห็น Order พร้อมเลขที่เอกสาร
```

### Prisma Schema ที่ต้องเพิ่ม

```prisma
model User {
  // ...existing fields
  flowAccountContactId  Int?
}

model Order {
  // ...existing fields
  flowAccountDocumentId     Int?
  flowAccountDocumentSerial String?
}
```

---

## 9. Environment Variables

เพิ่มใน `.env` และ VPS:

```env
FLOWACCOUNT_CLIENT_ID=your_client_id_here
FLOWACCOUNT_CLIENT_SECRET=your_client_secret_here
FLOWACCOUNT_BASE_URL=https://openapi.flowaccount.com/v1
```

> **ห้าม commit `.env`** — ใช้ `.env.example` แทน

---

## 10. Checklist ก่อน Implement

### Setup
- [ ] สมัคร/login FlowAccount → ได้ `client_id` และ `client_secret` (sandbox)
- [ ] เพิ่ม env vars ใน `.env` local และ VPS
- [ ] ทดสอบ token endpoint ด้วย Postman

### Backend (NestJS)
- [ ] สร้าง `FlowAccountModule` — จัดการ token caching + refresh
- [ ] สร้าง `ContactsFlowAccountService` — สร้าง contact เมื่อ user register
- [ ] สร้าง `DocumentsFlowAccountService` — สร้าง cash invoice เมื่อ order confirm
- [ ] เพิ่ม `flowAccountContactId` ใน User model (Prisma migration)
- [ ] เพิ่ม `flowAccountDocumentId`, `flowAccountDocumentSerial` ใน Order model (Prisma migration)

### Testing
- [ ] ทดสอบ create contact (sandbox)
- [ ] ทดสอบ create product (sandbox)
- [ ] ทดสอบ create cash invoice (sandbox)
- [ ] ยืนยันข้อมูลถูกต้องใน sandbox FlowAccount portal
- [ ] ขอ production credentials จาก FlowAccount staff

---

## Resources

| | URL |
|---|---|
| Official Docs | https://developers.flowaccount.com/tutorial/ |
| Product API | https://developers.flowaccount.com/tutorial/product-api/ |
| Document API | https://developers.flowaccount.com/tutorial/document-api/ |
| Partial Receipt | https://developers.flowaccount.com/tutorial/document-api/partial-receipt/ |
| GitHub SDK | https://github.com/flowaccount/flowaccount-openapi-sdk |
| Postman Collection | https://www.getpostman.com/collections/01e7c68d7093e2092a64 |
| Support Email | developer_support@flowaccount.com |
| Support Phone | 02-026-8989 |
