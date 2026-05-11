import { Module } from "@nestjs/common";
import { KBankController } from "./kbank.controller";
import { KBankService } from "./kbank.service";

@Module({
  controllers: [KBankController],
  providers: [KBankService],
  exports: [KBankService],
})
export class KBankModule {}
