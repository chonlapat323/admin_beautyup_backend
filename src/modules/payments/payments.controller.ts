import { Controller, Get, Param, Post } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { PaymentsService } from "./payments.service";

@ApiTags("Payments")
@Controller("payments")
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  @ApiOperation({ summary: "List payment transactions" })
  findAll() {
    return this.paymentsService.findAll();
  }

  @Post(":orderId/retry")
  @ApiOperation({ summary: "Retry payment" })
  retry(@Param("orderId") orderId: string) {
    return this.paymentsService.retry(orderId);
  }
}
