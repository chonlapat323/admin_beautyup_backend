import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiProperty, ApiPropertyOptional, PartialType, ApiTags } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsEnum, IsInt, IsNumber, IsOptional, IsString, Min } from "class-validator";
import { ProductStatus } from "@prisma/client";

import { ProductsService } from "./products.service";

enum ProductStatusDto {
  DRAFT = "DRAFT",
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
}

class CreateProductDto {
  @ApiProperty({ example: "SKU-001" })
  @IsString()
  sku!: string;

  @ApiProperty({ example: "Koleston Perfect" })
  @IsString()
  name!: string;

  @ApiProperty({ example: "koleston-perfect" })
  @IsString()
  slug!: string;

  @ApiProperty({ example: "Hair color product", required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 490 })
  @IsNumber()
  price!: number;

  @ApiProperty({ example: 450, required: false })
  @IsOptional()
  @IsNumber()
  specialPrice?: number;

  @ApiProperty({ example: "cat_001" })
  @IsString()
  categoryId!: string;

  @ApiProperty({ example: 200, required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  stock?: number;

  @ApiProperty({ enum: ProductStatusDto, example: ProductStatusDto.DRAFT, required: false })
  @IsOptional()
  @IsEnum(ProductStatusDto)
  status?: ProductStatusDto;
}

class UpdateProductDto extends PartialType(CreateProductDto) {}

class UpdateProductStatusDto {
  @ApiProperty({ enum: ProductStatusDto, example: ProductStatusDto.ACTIVE })
  @IsEnum(ProductStatusDto)
  status!: ProductStatusDto;
}

class ListProductsQueryDto {
  @ApiPropertyOptional({ example: "koleston" })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: "all" })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  page?: number;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  pageSize?: number;
}

@ApiTags("Products")
@Controller("products")
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @ApiOperation({ summary: "List products" })
  findAll(@Query() query: ListProductsQueryDto) {
    return this.productsService.findAll({
      search: query.search?.trim() || undefined,
      status: (query.status as "all" | "active" | "inactive" | "draft") || "all",
      page: query.page && query.page > 0 ? query.page : 1,
      pageSize: query.pageSize && query.pageSize > 0 ? query.pageSize : 10,
    });
  }

  @Post()
  @ApiOperation({ summary: "Create product" })
  create(@Body() dto: CreateProductDto) {
    return this.productsService.create({
      ...dto,
      status: dto.status as ProductStatus | undefined,
    });
  }

  @Get(":id")
  @ApiOperation({ summary: "Get product detail" })
  findOne(@Param("id") id: string) {
    return this.productsService.findOne(id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update product" })
  update(@Param("id") id: string, @Body() dto: UpdateProductDto) {
    return this.productsService.update(id, {
      ...dto,
      status: dto.status as ProductStatus | undefined,
    });
  }

  @Patch(":id/status")
  @ApiOperation({ summary: "Update product status" })
  updateStatus(@Param("id") id: string, @Body() dto: UpdateProductStatusDto) {
    return this.productsService.updateStatus(id, dto.status as ProductStatus);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete product" })
  remove(@Param("id") id: string) {
    return this.productsService.remove(id);
  }
}
