import { Module } from "@nestjs/common";
import { FlowAccountModule } from "../flowaccount/flowaccount.module";
import { ProductsController } from "./products.controller";
import { ProductsService } from "./products.service";

@Module({
  imports: [FlowAccountModule],
  controllers: [ProductsController],
  providers: [ProductsService],
})
export class ProductsModule {}
