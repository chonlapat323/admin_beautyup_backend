import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { RewardProductsController } from "./reward-products.controller";
import { RewardProductsService } from "./reward-products.service";

@Module({
  imports: [NotificationsModule],
  controllers: [RewardProductsController],
  providers: [RewardProductsService],
  exports: [RewardProductsService],
})
export class RewardProductsModule {}
