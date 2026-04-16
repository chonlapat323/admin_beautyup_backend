import { Injectable } from "@nestjs/common";

@Injectable()
export class AppService {
  getHealth(): string {
    return "Beauty Up admin backend is running.";
  }
}
