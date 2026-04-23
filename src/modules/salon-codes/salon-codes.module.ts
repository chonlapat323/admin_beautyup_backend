import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { SalonCodesController } from "./salon-codes.controller";
import { SalonCodesService } from "./salon-codes.service";

@Module({
  imports: [PrismaModule],
  controllers: [SalonCodesController],
  providers: [SalonCodesService],
  exports: [SalonCodesService],
})
export class SalonCodesModule {}
