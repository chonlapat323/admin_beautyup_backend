import { Injectable } from "@nestjs/common";

@Injectable()
export class ReferralsService {
  summary() {
    return {
      commissionRate: 0.03,
      totalCommission: 1200,
      pendingCommission: 300,
    };
  }

  history() {
    return [
      { memberId: "mem_001", referredMemberId: "mem_002", commissionAmount: 120, status: "PENDING" },
    ];
  }
}
