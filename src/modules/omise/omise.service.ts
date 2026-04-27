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
}
