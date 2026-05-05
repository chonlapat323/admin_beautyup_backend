import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from "@nestjs/swagger";
import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Min } from "class-validator";
import { Type } from "class-transformer";
import { RewardProductsService } from "./reward-products.service";

class CreateRewardProductDto {
  @ApiProperty() @IsString() name!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() imageUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() tempFile?: string;
  @ApiProperty() @IsNumber() @Min(1) @Type(() => Number) pointCost!: number;
  @ApiProperty() @IsInt() @Min(0) @Type(() => Number) stock!: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

class UpdateRewardProductDto {
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() imageUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() tempFile?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(1) @Type(() => Number) pointCost?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Type(() => Number) stock?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

@ApiTags("Reward Products")
@Controller("reward-products")
export class RewardProductsController {
  constructor(private readonly service: RewardProductsService) {}

  @Get()
  @ApiOperation({ summary: "List all reward products" })
  findAll() {
    return this.service.findAll();
  }

  @Get("redemptions")
  @ApiOperation({ summary: "List redemption logs with optional date range" })
  getRedemptions(@Query("from") from?: string, @Query("to") to?: string) {
    return this.service.getRedemptions(from, to);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get one reward product" })
  findOne(@Param("id") id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: "Create reward product" })
  create(@Body() dto: CreateRewardProductDto) {
    return this.service.create(dto);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update reward product" })
  update(@Param("id") id: string, @Body() dto: UpdateRewardProductDto) {
    return this.service.update(id, dto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete reward product" })
  remove(@Param("id") id: string) {
    return this.service.remove(id);
  }
}
