import { Module } from "@nestjs/common";
import { RewardProductsController } from "./reward-products.controller";
import { RewardProductsService } from "./reward-products.service";

@Module({
  controllers: [RewardProductsController],
  providers: [RewardProductsService],
  exports: [RewardProductsService],
})
export class RewardProductsModule {}
