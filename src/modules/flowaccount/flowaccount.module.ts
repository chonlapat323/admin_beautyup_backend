import { Module } from "@nestjs/common";

import { FlowAccountService } from "./flowaccount.service";

@Module({
  providers: [FlowAccountService],
  exports: [FlowAccountService],
})
export class FlowAccountModule {}
