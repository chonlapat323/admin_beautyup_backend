import { Controller, Post } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { KBankService } from "./kbank.service";

@ApiTags("KBank Exercises")
@Controller("kbank")
export class KBankController {
  constructor(private readonly kbankService: KBankService) {}

  @Post("payout/shop-s")
  @ApiOperation({ summary: "Exercise 6: Create Payout to Shop (level S)" })
  createPayoutShopS() {
    return this.kbankService.createPayoutToShopS();
  }
}
