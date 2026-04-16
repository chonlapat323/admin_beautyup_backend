import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiOperation, ApiProperty, PartialType, ApiTags } from "@nestjs/swagger";
import { IsArray, IsEnum, IsInt, IsNumber, IsOptional, IsString, Min } from "class-validator";

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

  @ApiProperty({ example: 20, required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  reserveStock?: number;

  @ApiProperty({ type: [String], example: ["https://example.com/image-1.jpg"], required: false })
  @IsOptional()
  @IsArray()
  images?: string[];
}

class UpdateProductDto extends PartialType(CreateProductDto) {}

class UpdateProductStatusDto {
  @ApiProperty({ enum: ProductStatusDto, example: ProductStatusDto.ACTIVE })
  @IsEnum(ProductStatusDto)
  status!: ProductStatusDto;
}

@ApiTags("Products")
@Controller("products")
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @ApiOperation({ summary: "List products" })
  findAll() {
    return this.productsService.findAll();
  }

  @Post()
  @ApiOperation({ summary: "Create product" })
  create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get product detail" })
  findOne(@Param("id") id: string) {
    return this.productsService.findOne(id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update product" })
  update(@Param("id") id: string, @Body() dto: UpdateProductDto) {
    return this.productsService.update(id, dto);
  }

  @Patch(":id/status")
  @ApiOperation({ summary: "Update product status" })
  updateStatus(@Param("id") id: string, @Body() dto: UpdateProductStatusDto) {
    return this.productsService.updateStatus(id, dto.status);
  }
}
