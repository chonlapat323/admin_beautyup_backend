import { Injectable, Logger } from '@nestjs/common';

type TokenCache = {
  accessToken: string;
  expiresAt: number;
};

@Injectable()
export class FlowAccountService {
  private readonly logger = new Logger(FlowAccountService.name);
  private readonly tokenUrl =
    process.env.FLOWACCOUNT_TOKEN_URL ??
    'https://openapi.flowaccount.com/test/token';
  private readonly baseUrl =
    process.env.FLOWACCOUNT_BASE_URL ?? 'https://openapi.flowaccount.com/test';
  private readonly clientId = process.env.FLOWACCOUNT_CLIENT_ID ?? '';
  private readonly clientSecret = process.env.FLOWACCOUNT_CLIENT_SECRET ?? '';
  private tokenCache: TokenCache | null = null;

  private async getToken(): Promise<string> {
    if (this.tokenCache && Date.now() < this.tokenCache.expiresAt) {
      this.logger.debug('[getToken] Using cached token');
      return this.tokenCache.accessToken;
    }

    this.logger.debug(`[getToken] Requesting new token from: ${this.tokenUrl}`);
    this.logger.debug(`[getToken] client_id: ${this.clientId}`);

    let res: Response;
    try {
      res = await fetch(this.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: this.clientId,
          client_secret: this.clientSecret,
          scope: 'flowaccount-api',
        }),
      });
    } catch (fetchErr) {
      this.logger.error(
        `[getToken] fetch failed (network error): ${String(fetchErr)}`,
      );
      throw fetchErr;
    }

    this.logger.debug(`[getToken] response status: ${res.status}`);
    const rawBody = await res.text();
    this.logger.debug(`[getToken] response body: ${rawBody}`);

    if (!res.ok) {
      throw new Error(`FlowAccount token error: ${res.status} ${rawBody}`);
    }

    const data = JSON.parse(rawBody) as {
      access_token: string;
      expires_in: number;
    };
    this.logger.debug(
      `[getToken] token obtained, expires_in: ${data.expires_in}s`,
    );

    this.tokenCache = {
      accessToken: data.access_token,
      expiresAt: Date.now() + (data.expires_in - 300) * 1000,
    };

    return this.tokenCache.accessToken;
  }

  async createContact(member: {
    fullName: string;
    email?: string | null;
    phone?: string | null;
  }): Promise<number | null> {
    try {
      this.logger.debug(`[createContact] START for member: ${member.fullName}`);

      const token = await this.getToken();
      this.logger.debug('[createContact] token ready');

      const contactUrl = `${this.baseUrl}/contacts`;
      const payload = {
        contactName: member.fullName,
        contactPerson: member.fullName,
        contactEmail: member.email ?? '',
        contactMobile: member.phone ?? '',
        contactBranch: 'สำนักงานใหญ่',
        contactGroup: 1,
        contactType: 3,
      };

      this.logger.debug(`[createContact] POST ${contactUrl}`);
      this.logger.debug(`[createContact] payload: ${JSON.stringify(payload)}`);

      let res: Response;
      try {
        res = await fetch(contactUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
      } catch (fetchErr) {
        this.logger.error(
          `[createContact] fetch failed (network error): ${String(fetchErr)}`,
        );
        return null;
      }

      this.logger.debug(`[createContact] response status: ${res.status}`);
      const rawBody = await res.text();
      this.logger.debug(`[createContact] response body: ${rawBody}`);

      if (!res.ok) {
        this.logger.warn(`[createContact] FAILED (${res.status}): ${rawBody}`);
        return null;
      }

      const data = JSON.parse(rawBody) as {
        data?: { list?: { id?: number }[] };
        status?: boolean;
      };
      const contactId = data?.data?.list?.[0]?.id ?? null;
      this.logger.log(`[createContact] SUCCESS contactId=${contactId}`);
      return contactId;
    } catch (error) {
      this.logger.error(`[createContact] EXCEPTION: ${String(error)}`);
      return null;
    }
  }

  async createItem(product: {
    sku: string;
    name: string;
    price: number;
    stock: number;
    categoryName?: string | null;
  }): Promise<string | null> {
    try {
      this.logger.debug(`[createItem] START sku=${product.sku}`);
      const token = await this.getToken();

      const today = new Date().toISOString().slice(0, 10);
      const payload = {
        type: 5,
        code: product.sku,
        name: product.name,
        sellPrice: product.price,
        sellVatType: 3,
        inventoryPublishedOn: today,
        inventoryQuantity: product.stock,
        inventoryPrice: 0,
        ...(product.categoryName ? { categoryName: product.categoryName } : {}),
      };

      this.logger.debug(`[createItem] payload: ${JSON.stringify(payload)}`);

      const res = await fetch(`${this.baseUrl}/products`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const rawBody = await res.text();
      this.logger.debug(`[createItem] status=${res.status} body=${rawBody}`);

      if (!res.ok) {
        this.logger.warn(`[createItem] FAILED (${res.status}): ${rawBody}`);
        return null;
      }

      const data = JSON.parse(rawBody) as {
        data?: { list?: { id?: string }[] };
      };
      const itemId = data?.data?.list?.[0]?.id ?? null;
      this.logger.log(`[createItem] SUCCESS itemId=${itemId}`);
      return itemId;
    } catch (error) {
      this.logger.error(`[createItem] EXCEPTION: ${String(error)}`);
      return null;
    }
  }

  async updateItem(
    itemId: string,
    product: {
      sku: string;
      name: string;
      price: number;
      categoryName?: string | null;
    },
  ): Promise<void> {
    try {
      this.logger.debug(`[updateItem] itemId=${itemId} sku=${product.sku}`);
      const token = await this.getToken();

      const payload = {
        type: 5,
        code: product.sku,
        name: product.name,
        sellPrice: product.price,
        sellVatType: 3,
        ...(product.categoryName ? { categoryName: product.categoryName } : {}),
      };

      this.logger.debug(`[updateItem] payload: ${JSON.stringify(payload)}`);

      const res = await fetch(`${this.baseUrl}/products/${itemId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const rawBody = await res.text();
      if (!res.ok) {
        this.logger.warn(`[updateItem] FAILED (${res.status}): ${rawBody}`);
        return;
      }
      this.logger.log(`[updateItem] SUCCESS itemId=${itemId}`);
    } catch (error) {
      this.logger.error(`[updateItem] EXCEPTION: ${String(error)}`);
    }
  }

  async createReceipt(order: {
    orderNumber: string;
    orderId: string;
    publishedOn: string;
    contactId?: number | null;
    contactName: string;
    contactEmail?: string | null;
    contactPhone?: string | null;
    subtotal: number;
    grandTotal: number;
    items: { name: string; quantity: number; pricePerUnit: number; total: number }[];
  }): Promise<number | null> {
    try {
      this.logger.debug(`[createReceipt] orderId=${order.orderId}`);
      const token = await this.getToken();

      // Step 1 — create Tax Invoice
      const taxPayload = {
        recordId: 0,
        documentStructureType: 'SimpleDocument',
        publishedOn: order.publishedOn,
        creditType: 3,
        reference: order.orderNumber,
        externalDocumentId: order.orderId,
        ...(order.contactId ? { contactId: order.contactId } : {}),
        contactName: order.contactName,
        contactEmail: order.contactEmail ?? '',
        contactNumber: order.contactPhone ?? '',
        contactGroup: 1,
        subTotal: order.subtotal,
        discountAmount: 0,
        totalAfterDiscount: order.subtotal,
        isVat: false,
        vatAmount: 0,
        grandTotal: order.grandTotal,
        items: order.items.map((i) => ({
          type: 3,
          name: i.name,
          quantity: i.quantity,
          pricePerUnit: i.pricePerUnit,
          total: i.total,
        })),
      };

      this.logger.debug(`[createReceipt] Step1 POST /tax-invoices`);
      const taxRes = await fetch(`${this.baseUrl}/tax-invoices`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(taxPayload),
      });

      const taxBody = await taxRes.text();
      this.logger.debug(`[createReceipt] Step1 status=${taxRes.status} body=${taxBody}`);

      if (!taxRes.ok) {
        this.logger.warn(`[createReceipt] Step1 FAILED (${taxRes.status}): ${taxBody}`);
        return null;
      }

      const taxData = JSON.parse(taxBody) as { data?: { recordId?: number } };
      const taxRecordId = taxData?.data?.recordId;
      if (!taxRecordId) {
        this.logger.warn(`[createReceipt] Step1 no recordId in response`);
        return null;
      }

      this.logger.debug(`[createReceipt] Step1 taxRecordId=${taxRecordId}`);

      // Step 2 — upgrade to Receipt with payment (cash = no extra channel config needed)
      const upgradePayload = {
        recordId: 0,
        documentStructureType: 'UpgradeSimpleDocument',
        documentPaymentStructureType: 'SimpleDocumentWithPaymentReceivingCash',
        documentReference: [{ documentId: taxRecordId }],
        publishedOn: order.publishedOn,
        paymentDate: order.publishedOn,
        paymentMethod: 1,
        collected: order.grandTotal,
        items: order.items.map((i) => ({
          type: 3,
          name: i.name,
          quantity: i.quantity,
          pricePerUnit: i.pricePerUnit,
          total: i.total,
        })),
      };

      this.logger.debug(`[createReceipt] Step2 POST /upgrade/receipts/with-payment`);
      const receiptRes = await fetch(`${this.baseUrl}/upgrade/receipts/with-payment`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(upgradePayload),
      });

      const receiptBody = await receiptRes.text();
      this.logger.debug(`[createReceipt] Step2 status=${receiptRes.status} body=${receiptBody}`);

      if (!receiptRes.ok) {
        this.logger.warn(`[createReceipt] Step2 FAILED (${receiptRes.status}): ${receiptBody}`);
        return null;
      }

      const receiptData = JSON.parse(receiptBody) as { data?: { recordId?: number } };
      const docId = receiptData?.data?.recordId ?? null;
      this.logger.log(`[createReceipt] SUCCESS receiptDocId=${docId}`);
      return docId;
    } catch (error) {
      this.logger.error(`[createReceipt] EXCEPTION: ${String(error)}`);
      return null;
    }
  }

  async getDocumentShareLink(documentId: number): Promise<string | null> {
    try {
      this.logger.debug(`[getDocumentShareLink] documentId=${documentId}`);
      const token = await this.getToken();

      const res = await fetch(`${this.baseUrl}/receipts/sharedocument`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId, culture: 'th' }),
      });

      const rawBody = await res.text();
      this.logger.debug(`[getDocumentShareLink] status=${res.status} body=${rawBody}`);

      if (!res.ok) {
        this.logger.warn(`[getDocumentShareLink] FAILED (${res.status}): ${rawBody}`);
        return null;
      }

      const data = JSON.parse(rawBody) as { data?: { link?: string } };
      return data?.data?.link ?? null;
    } catch (error) {
      this.logger.error(`[getDocumentShareLink] EXCEPTION: ${String(error)}`);
      return null;
    }
  }

  async updateContactAddress(
    contactId: number,
    fullName: string,
    email: string | null,
    phone: string | null,
    address: {
      addressLine1: string;
      addressLine2?: string | null;
      district?: string | null;
      province?: string | null;
      postalCode?: string | null;
    },
  ): Promise<void> {
    try {
      this.logger.debug(`[updateContactAddress] contactId=${contactId}`);
      const token = await this.getToken();

      const addressParts = [
        address.addressLine1,
        address.addressLine2,
        address.district ? `อ.${address.district}` : null,
        address.province ? `จ.${address.province}` : null,
      ].filter(Boolean).join(' ');

      const payload = {
        contactName: fullName,
        contactPerson: fullName,
        contactGroup: 1,
        contactType: 3,
        contactBranch: 'สำนักงานใหญ่',
        contactEmail: email ?? '',
        contactMobile: phone ?? '',
        contactAddress: addressParts,
        contactZipCode: address.postalCode ?? '',
        conatactShippingAddress: addressParts,
        contactShippingAddress: addressParts,
      };

      this.logger.debug(`[updateContactAddress] payload: ${JSON.stringify(payload)}`);

      const res = await fetch(`${this.baseUrl}/contacts/${contactId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const rawBody = await res.text();
      if (!res.ok) {
        this.logger.warn(`[updateContactAddress] FAILED (${res.status}): ${rawBody}`);
        return;
      }
      this.logger.log(`[updateContactAddress] SUCCESS contactId=${contactId}`);
    } catch (error) {
      this.logger.error(`[updateContactAddress] EXCEPTION: ${String(error)}`);
    }
  }
}
