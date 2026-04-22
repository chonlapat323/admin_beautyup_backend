import { Module } from "@nestjs/common";
import { CommissionModule } from "../commission/commission.module";
import { MobileController } from "./mobile.controller";
import { MobileService } from "./mobile.service";

@Module({
  imports: [CommissionModule],
  controllers: [MobileController],
  providers: [MobileService],
})
export class MobileModule {}
