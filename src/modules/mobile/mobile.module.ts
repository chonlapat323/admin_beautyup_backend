import { Module } from "@nestjs/common";
import { CommissionModule } from "../commission/commission.module";
import { FlowAccountModule } from "../flowaccount/flowaccount.module";
import { OmiseModule } from "../omise/omise.module";
import { SalonCodesModule } from "../salon-codes/salon-codes.module";
import { RewardProductsModule } from "../reward-products/reward-products.module";
import { SettingsModule } from "../settings/settings.module";
import { MobileController } from "./mobile.controller";
import { MobileService } from "./mobile.service";

@Module({
  imports: [CommissionModule, FlowAccountModule, OmiseModule, SalonCodesModule, SettingsModule, RewardProductsModule],
  controllers: [MobileController],
  providers: [MobileService],
})
export class MobileModule {}
