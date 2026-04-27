import { Injectable, Logger } from "@nestjs/common";

type ChargeStatus = "successful" | "failed" | "pending" | "reversed" | "expired";

type OmiseCharge = {
  id: string;
  status: ChargeStatus;
  amount: number;
  currency: string;
  description?: string;
  failure_code?: string;
  failure_message?: string;
  expires_at?: string;
  source?: {
    scannable_code?: {
      type: string;
      image: { download_uri: string; filename: string };
    };
  };
};

@Injectable()
export class OmiseService {
  private readonly logger = new Logger(OmiseService.name);
  private readonly secretKey = process.env.OMISE_SECRET_KEY ?? "";
  private readonly apiUrl = "https://api.omise.co";

  private get authHeader(): string {
    return `Basic ${Buffer.from(`${this.secretKey}:`).toString("base64")}`;
  }

  async createCharge(params: {
    token: string;
    amountTHB: number;
    description: string;
  }): Promise<OmiseCharge> {
    const amountSatangs = Math.round(params.amountTHB * 100);

    this.logger.debug(`[createCharge] amount=${amountSatangs} satangs, token=${params.token}`);

    const res = await fetch(`${this.apiUrl}/charges`, {
      method: "POST",
      headers: {
        Authorization: this.authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: amountSatangs,
        currency: "thb",
        card: params.token,
        description: params.description,
        capture: true,
      }),
    });

    const data = (await res.json()) as OmiseCharge & { message?: string };
    this.logger.debug(`[createCharge] status=${res.status} chargeStatus=${data.status}`);

    if (!res.ok) {
      throw new Error(data.message ?? "Payment failed");
    }

    return data;
  }

  async createPromptPayCharge(params: {
    amountTHB: number;
    description: string;
  }): Promise<{ chargeId: string; qrCodeUrl: string; expiresAt: string }> {
    const amountSatangs = Math.round(params.amountTHB * 100);
    this.logger.debug(`[createPromptPayCharge] amount=${amountSatangs} satangs`);

    const sourceRes = await fetch(`${this.apiUrl}/sources`, {
      method: "POST",
      headers: { Authorization: this.authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ type: "promptpay", amount: amountSatangs, currency: "thb" }),
    });

    const sourceData = (await sourceRes.json()) as { id: string; message?: string };
    if (!sourceRes.ok) throw new Error(sourceData.message ?? "Failed to create PromptPay source");

    this.logger.debug(`[createPromptPayCharge] source=${sourceData.id}`);

    const chargeRes = await fetch(`${this.apiUrl}/charges`, {
      method: "POST",
      headers: { Authorization: this.authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: amountSatangs,
        currency: "thb",
        source: sourceData.id,
        description: params.description,
      }),
    });

    const charge = (await chargeRes.json()) as OmiseCharge & { message?: string };
    this.logger.debug(`[createPromptPayCharge] chargeId=${charge.id} status=${charge.status}`);

    if (!chargeRes.ok) throw new Error(charge.message ?? "Failed to create PromptPay charge");

    const qrCodeUrl = charge.source?.scannable_code?.image?.download_uri ?? "";
    const expiresAt = charge.expires_at ?? new Date(Date.now() + 15 * 60 * 1000).toISOString();

    return { chargeId: charge.id, qrCodeUrl, expiresAt };
  }

  async getCharge(chargeId: string): Promise<OmiseCharge> {
    const res = await fetch(`${this.apiUrl}/charges/${chargeId}`, {
      headers: { Authorization: this.authHeader },
    });
    const data = (await res.json()) as OmiseCharge & { message?: string };
    if (!res.ok) throw new Error(data.message ?? "Failed to get charge");
    return data;
  }
}
