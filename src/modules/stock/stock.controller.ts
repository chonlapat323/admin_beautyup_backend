import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiProperty, ApiTags } from "@nestjs/swagger";
import { IsInt, IsNotEmpty, IsString } from "class-validator";
import { Type } from "class-transformer";
import { StockService } from "./stock.service";

class AdjustStockDto {
  @ApiProperty() @IsString() @IsNotEmpty() productId!: string;
  @ApiProperty({ description: "Positive = stock in, negative = stock out" }) @IsInt() @Type(() => Number) delta!: number;
  @ApiProperty() @IsString() @IsNotEmpty() reason!: string;
}

@ApiTags("Stock")
@Controller("stock")
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Get("summary")
  @ApiOperation({ summary: "Get stock summary for all products" })
  summary() {
    return this.stockService.summary();
  }

  @Get("movements")
  @ApiOperation({ summary: "Get stock movement history" })
  movements(@Query("productId") productId?: string) {
    return this.stockService.movements(productId);
  }

  @Post("adjust")
  @ApiOperation({ summary: "Manually adjust stock for a product" })
  adjust(@Body() dto: AdjustStockDto) {
    return this.stockService.adjust(dto);
  }
}
