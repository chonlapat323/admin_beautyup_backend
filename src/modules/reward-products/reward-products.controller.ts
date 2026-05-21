import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from "@nestjs/swagger";
import { IsArray, IsBoolean, IsEnum, IsInt, IsOptional, IsString, Min } from "class-validator";
import { Type } from "class-transformer";
import { RedemptionStatus } from "@prisma/client";
import { RewardProductsService } from "./reward-products.service";

class OrderedImageItemDto {
  @IsString() kind!: "existing" | "temp";
  @IsOptional() @IsString() id?: string;
  @IsOptional() @IsString() filename?: string;
}

class CreateRewardProductDto {
  @ApiProperty() @IsString() name!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsArray() @IsString({ each: true }) tempFiles?: string[];
  @ApiProperty() @IsInt() @Min(1) @Type(() => Number) pointCost!: number;
  @ApiProperty() @IsInt() @Min(0) @Type(() => Number) stock!: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

class UpdateRewardProductDto {
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsArray() orderedImages?: OrderedImageItemDto[];
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Type(() => Number) pointCost?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Type(() => Number) stock?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

class UpdateRedemptionStatusDto {
  @ApiProperty({ enum: RedemptionStatus }) @IsEnum(RedemptionStatus) status!: RedemptionStatus;
  @ApiPropertyOptional() @IsOptional() @IsString() trackingNumber?: string;
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

  @Get("redemptions/:id")
  @ApiOperation({ summary: "Get one redemption by id" })
  getRedemptionById(@Param("id") id: string) {
    return this.service.getRedemptionById(id);
  }

  @Patch("redemptions/:id/status")
  @ApiOperation({ summary: "Update redemption fulfillment status" })
  updateRedemptionStatus(@Param("id") id: string, @Body() dto: UpdateRedemptionStatusDto) {
    return this.service.updateRedemptionStatus(id, dto.status, dto.trackingNumber);
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
