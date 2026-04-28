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
  }): Promise<{ taxInvoiceId: number; receiptId: number } | null> {
    try {
      this.logger.debug(`[createReceipt] orderId=${order.orderId}`);
      const token = await this.getToken();

      const baseContact = {
        ...(order.contactId ? { contactId: order.contactId } : {}),
        contactName: order.contactName,
        contactEmail: order.contactEmail ?? '',
        contactNumber: order.contactPhone ?? '',
        contactGroup: 1,
      };
      const baseItems = order.items.map((i) => ({
        type: 3,
        name: i.name,
        quantity: i.quantity,
        pricePerUnit: i.pricePerUnit,
        total: i.total,
      }));

      // Step 1: Create Tax Invoice (unpaid)
      const invoicePayload = {
        recordId: 0,
        documentStructureType: 'SimpleDocument',
        publishedOn: order.publishedOn,
        reference: order.orderNumber,
        externalDocumentId: order.orderId,
        ...baseContact,
        subTotal: order.subtotal,
        discountAmount: 0,
        totalAfterDiscount: order.subtotal,
        isVat: false,
        vatAmount: 0,
        grandTotal: order.grandTotal,
        items: baseItems,
      };

      this.logger.debug(`[createReceipt] POST /tax-invoices`);
      const invRes = await fetch(`${this.baseUrl}/tax-invoices`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(invoicePayload),
      });

      const invBody = await invRes.text();
      this.logger.debug(`[createReceipt] tax-invoice status=${invRes.status} body=${invBody}`);

      if (!invRes.ok) {
        this.logger.warn(`[createReceipt] tax-invoice FAILED (${invRes.status}): ${invBody}`);
        return null;
      }

      const invData = JSON.parse(invBody) as { data?: { recordId?: number; documentSerial?: string } };
      const taxInvoiceId = invData?.data?.recordId;
      const taxInvoiceSerial = invData?.data?.documentSerial;
      if (!taxInvoiceId || !taxInvoiceSerial) {
        this.logger.warn(`[createReceipt] missing taxInvoiceId or serial`);
        return null;
      }
      this.logger.log(`[createReceipt] tax-invoice created id=${taxInvoiceId} serial=${taxInvoiceSerial}`);

      // Step 2: Create Receipt referencing the Tax Invoice
      const receiptPayload = {
        documentStructureType: 'SimpleDocument',
        documentPaymentStructureType: 'UpgradeSimpleDocumentWithPaymentReceivingCash',
        publishedOn: order.publishedOn,
        paymentDate: order.publishedOn,
        paymentMethod: 1,
        collected: order.grandTotal,
        documentReference: [{
          recordId: taxInvoiceId,
          referenceDocumentSerial: taxInvoiceSerial,
          referenceDocumentType: 7,
        }],
        ...baseContact,
        subTotal: order.subtotal,
        discountAmount: 0,
        totalAfterDiscount: order.subtotal,
        isVat: false,
        vatAmount: 0,
        grandTotal: order.grandTotal,
        items: baseItems,
      };

      this.logger.debug(`[createReceipt] POST /upgrade/receipts/with-payment`);
      const recRes = await fetch(`${this.baseUrl}/upgrade/receipts/with-payment`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(receiptPayload),
      });

      const recBody = await recRes.text();
      this.logger.debug(`[createReceipt] receipt status=${recRes.status} body=${recBody}`);

      if (!recRes.ok) {
        this.logger.warn(`[createReceipt] receipt FAILED (${recRes.status}): ${recBody}`);
        // Return tax invoice only if receipt fails
        return { taxInvoiceId, receiptId: 0 };
      }

      const recData = JSON.parse(recBody) as { data?: { recordId?: number } };
      const receiptId = recData?.data?.recordId ?? 0;
      this.logger.log(`[createReceipt] receipt created id=${receiptId}`);

      return { taxInvoiceId, receiptId };
    } catch (error) {
      this.logger.error(`[createReceipt] EXCEPTION: ${String(error)}`);
      return null;
    }
  }

  async getShareLink(documentId: number, type: 'tax-invoice' | 'receipt'): Promise<string | null> {
    try {
      this.logger.debug(`[getShareLink] documentId=${documentId} type=${type}`);
      const token = await this.getToken();
      const endpoint = type === 'receipt' ? 'receipts' : 'tax-invoices';

      const res = await fetch(`${this.baseUrl}/${endpoint}/sharedocument`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId, culture: 'th' }),
      });

      const rawBody = await res.text();
      if (!res.ok) {
        this.logger.warn(`[getShareLink] FAILED (${res.status}): ${rawBody}`);
        return null;
      }

      const data = JSON.parse(rawBody) as { data?: { link?: string } };
      return data?.data?.link ?? null;
    } catch (error) {
      this.logger.error(`[getShareLink] EXCEPTION: ${String(error)}`);
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
