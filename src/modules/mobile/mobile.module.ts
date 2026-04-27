import { Module } from "@nestjs/common";
import { CommissionModule } from "../commission/commission.module";
import { FlowAccountModule } from "../flowaccount/flowaccount.module";
import { OmiseModule } from "../omise/omise.module";
import { SalonCodesModule } from "../salon-codes/salon-codes.module";
import { MobileController } from "./mobile.controller";
import { MobileService } from "./mobile.service";

@Module({
  imports: [CommissionModule, FlowAccountModule, OmiseModule, SalonCodesModule],
  controllers: [MobileController],
  providers: [MobileService],
})
export class MobileModule {}
