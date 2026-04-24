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

  async updateContactAddress(
    contactId: number,
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
        address.district,
        address.province,
      ].filter(Boolean).join(' ');

      const payload = {
        contactAddress: addressParts,
        contactZipCode: address.postalCode ?? '',
        conatactShippingAddress: addressParts,
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
