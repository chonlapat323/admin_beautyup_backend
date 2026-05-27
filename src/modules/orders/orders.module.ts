import { Module } from "@nestjs/common";
import { AuditLogModule } from "../audit-log/audit-log.module";
import { CommissionModule } from "../commission/commission.module";
import { PrismaModule } from "../prisma/prisma.module";
import { StockModule } from "../stock/stock.module";
import { OrdersController } from "./orders.controller";
import { OrdersGateway } from "./orders.gateway";
import { OrdersService } from "./orders.service";

@Module({
  imports: [PrismaModule, CommissionModule, StockModule, AuditLogModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrdersGateway],
})
export class OrdersModule {}
