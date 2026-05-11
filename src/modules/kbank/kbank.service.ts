import { Injectable, Logger } from "@nestjs/common";

type TokenCache = { token: string; expiresAt: number };

export type KPlusPaymentResult = {
  deepLink: string;
  partnerOrderID: string;
  partnerPaymentID: string;
};

function kbankId(prefix: string): string {
  const ts = Date.now().toString();
  const rand = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
  return (prefix + ts + rand).slice(0, 17);
}

@Injectable()
export class KBankService {
  private readonly logger = new Logger(KBankService.name);
  private readonly apiUrl = process.env.KBANK_API_URL ?? "https://openapi-sandbox.kasikornbank.com";
  private readonly consumerId = process.env.KBANK_CONSUMER_ID ?? "";
  private readonly consumerSecret = process.env.KBANK_CONSUMER_SECRET ?? "";
  private readonly projectId = process.env.KBANK_PROJECT_ID ?? "999";
  private readonly partnerId = process.env.KBANK_PARTNER_ID ?? "0001";
  private readonly projectKey = process.env.KBANK_PROJECT_KEY ?? "d4bded59200547bc85903574a293831b";
  private readonly partnerShopId = process.env.KBANK_PARTNER_SHOP_ID ?? "shop001";
  private readonly switchBackUrl = process.env.KBANK_SWITCH_BACK_URL ?? "https://mpp-kgptest.web.app";
  private readonly testMode = process.env.KBANK_TEST_MODE === "true";

  private tokenCache: TokenCache | null = null;

  private get basicAuth(): string {
    return Buffer.from(`${this.consumerId}:${this.consumerSecret}`).toString("base64");
  }

  async getAccessToken(): Promise<string> {
    if (this.tokenCache && Date.now() < this.tokenCache.expiresAt - 60_000) {
      return this.tokenCache.token;
    }

    const res = await fetch(`${this.apiUrl}/v2/oauth/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${this.basicAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "x-test-mode": "true",
        "env-id": "OAUTH2",
      },
      body: "grant_type=client_credentials",
    });

    const data = (await res.json()) as { access_token?: string; expires_in?: number; error?: string };
    if (!res.ok || !data.access_token) {
      throw new Error(`KBank OAuth failed: ${data.error ?? res.statusText}`);
    }

    this.tokenCache = {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in ?? 1740) * 1000,
    };
    this.logger.debug("[KBank] Access token refreshed");
    return this.tokenCache.token;
  }

  async createKPlusPayment(amountTHB: number): Promise<KPlusPaymentResult> {
    const accessToken = await this.getAccessToken();

    const partnerOrderID = kbankId("O");
    const partnerPaymentID = kbankId("P");
    const requestId = `req-${Date.now().toString(36)}`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      RequestID: requestId,
      ProjectID: this.projectId,
      PartnerID: this.partnerId,
      ProjectKey: this.projectKey,
    };
    if (this.testMode) {
      headers["x-test-mode"] = "true";
      headers["env-id"] = "mpp-paykplus";
    }

    const body = {
      partnerShopID: this.partnerShopId,
      partnerOrderID,
      partnerPaymentID,
      amount: amountTHB.toFixed(2),
      currencyCode: "THB",
      payoutType: "DELAY",
      switchBackURL: this.switchBackUrl,
    };

    this.logger.debug(`[KBank] RequestID=${requestId} partnerOrderID=${partnerOrderID} amount=${body.amount}`);

    const res = await fetch(`${this.apiUrl}/v1/mpp/payment/v1/appswitch/kplus`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    const data = (await res.json()) as Record<string, unknown> & { message?: string };
    this.logger.debug(`[KBank] createKPlusPayment response: ${JSON.stringify(data)}`);

    if (!res.ok) {
      throw new Error((data.message as string | undefined) ?? "KBank payment creation failed");
    }

    return {
      deepLink: (data.deepLink as string | undefined) ?? (data.redirectURL as string | undefined) ?? "",
      partnerOrderID,
      partnerPaymentID,
    };
  }
}
