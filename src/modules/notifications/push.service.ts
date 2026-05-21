import { Injectable, Logger } from "@nestjs/common";

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  async send(
    expoPushToken: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<void> {
    try {
      const response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ to: expoPushToken, title, body, data }),
      });

      if (!response.ok) {
        const text = await response.text();
        this.logger.error(`Expo push failed ${response.status}: ${text}`);
      }
    } catch (err) {
      this.logger.error("Expo push error", err);
    }
  }
}
