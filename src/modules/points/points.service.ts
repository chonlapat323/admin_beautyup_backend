import { Injectable } from "@nestjs/common";

@Injectable()
export class PointsService {
  rules() {
    return {
      spendingThreshold: 3000,
      earnedPoint: 300,
      formula: "floor(net_paid / 3000) * 300",
    };
  }

  history(memberId: string) {
    return {
      memberId,
      transactions: [
        { type: "EARN", points: 300, orderNumber: "BU-24003" },
        { type: "REDEEM", points: -100, reward: "Reward Item A" },
      ],
    };
  }
}
