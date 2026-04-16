import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { ReferralsService } from "./referrals.service";

@ApiTags("Referrals")
@Controller("referrals")
export class ReferralsController {
  constructor(private readonly referralsService: ReferralsService) {}

  @Get("summary")
  @ApiOperation({ summary: "Get referral summary" })
  summary() {
    return this.referralsService.summary();
  }

  @Get("history")
  @ApiOperation({ summary: "Get referral commission history" })
  history() {
    return this.referralsService.history();
  }
}
