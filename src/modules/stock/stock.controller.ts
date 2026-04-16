import { Body, Controller, Get, Post } from "@nestjs/common";
import { ApiOperation, ApiProperty, ApiTags } from "@nestjs/swagger";
import { IsInt, IsString } from "class-validator";

import { StockService } from "./stock.service";

class AdjustStockDto {
  @ApiProperty({ example: "prod_001" })
  @IsString()
  productId!: string;

  @ApiProperty({ example: 10 })
  @IsInt()
  quantity!: number;

  @ApiProperty({ example: "manual correction" })
  @IsString()
  reason!: string;
}

@ApiTags("Stock")
@Controller("stock")
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Get("summary")
  @ApiOperation({ summary: "Get stock summary" })
  summary() {
    return this.stockService.summary();
  }

  @Post("adjust")
  @ApiOperation({ summary: "Adjust stock" })
  adjust(@Body() dto: AdjustStockDto) {
    return this.stockService.adjust(dto);
  }
}
