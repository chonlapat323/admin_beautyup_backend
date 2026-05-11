import { Module } from "@nestjs/common";
import { KBankService } from "./kbank.service";

@Module({
  providers: [KBankService],
  exports: [KBankService],
})
export class KBankModule {}
