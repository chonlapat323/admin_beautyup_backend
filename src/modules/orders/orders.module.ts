import { Module } from "@nestjs/common";
import { CommissionModule } from "../commission/commission.module";
import { PrismaModule } from "../prisma/prisma.module";
import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";

@Module({
  imports: [PrismaModule, CommissionModule],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
