import { Module } from "@nestjs/common";
import { CommissionModule } from "../commission/commission.module";
import { PrismaModule } from "../prisma/prisma.module";
import { StockModule } from "../stock/stock.module";
import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";

@Module({
  imports: [PrismaModule, CommissionModule, StockModule],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
