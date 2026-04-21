import { Injectable, Logger } from "@nestjs/common";

type TokenCache = {
  accessToken: string;
  expiresAt: number;
};

@Injectable()
export class FlowAccountService {
  private readonly logger = new Logger(FlowAccountService.name);
  private readonly baseUrl = process.env.FLOWACCOUNT_BASE_URL ?? "https://openapi.flowaccount.com/v1";
  private readonly clientId = process.env.FLOWACCOUNT_CLIENT_ID ?? "";
  private readonly clientSecret = process.env.FLOWACCOUNT_CLIENT_SECRET ?? "";
  private tokenCache: TokenCache | null = null;

  private async getToken(): Promise<string> {
    if (this.tokenCache && Date.now() < this.tokenCache.expiresAt) {
      return this.tokenCache.accessToken;
    }

    const res = await fetch(`${this.baseUrl}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }),
    });

    if (!res.ok) {
      throw new Error(`FlowAccount token error: ${res.status}`);
    }

    const data = (await res.json()) as { access_token: string; expires_in: number };

    // refresh 5 minutes before actual expiry
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
      const token = await this.getToken();

      const res = await fetch(`${this.baseUrl}/contacts`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contactName: member.fullName,
          contactEmail: member.email ?? "",
          contactMobile: member.phone ?? "",
          contactBranch: "สำนักงานใหญ่",
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        this.logger.warn(`FlowAccount createContact failed (${res.status}): ${err}`);
        return null;
      }

      const data = (await res.json()) as { data?: { id?: number } };
      return data?.data?.id ?? null;
    } catch (error) {
      this.logger.error("FlowAccount createContact error", error);
      return null;
    }
  }
}
