import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { ShadesController } from "./shades.controller";
import { ShadesService } from "./shades.service";

@Module({
  imports: [PrismaModule],
  controllers: [ShadesController],
  providers: [ShadesService],
  exports: [ShadesService],
})
export class ShadesModule {}
