import { existsSync, mkdirSync } from "fs";
import { extname, join } from "path";
import { diskStorage } from "multer";
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiConsumes, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from "class-validator";
import { ProductStatus } from "@prisma/client";

import { ProductsService } from "./products.service";

enum ProductStatusDto {
  DRAFT = "DRAFT",
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
}

class OrderedImageItemDto {
  @ApiProperty({ enum: ["existing", "temp"] })
  @IsEnum(["existing", "temp"])
  kind!: "existing" | "temp";

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  filename?: string;
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

  @ApiPropertyOptional({ example: "Hair color product" })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 490 })
  @IsNumber()
  price!: number;

  @ApiPropertyOptional({ example: 450 })
  @IsOptional()
  @IsNumber()
  specialPrice?: number;

  @ApiProperty({ example: "cat_001" })
  @IsString()
  categoryId!: string;

  @ApiPropertyOptional({ example: 200 })
  @IsOptional()
  @IsInt()
  @Min(0)
  stock?: number;

  @ApiPropertyOptional({ enum: ProductStatusDto, example: ProductStatusDto.DRAFT })
  @IsOptional()
  @IsEnum(ProductStatusDto)
  status?: ProductStatusDto;

  @ApiPropertyOptional({ type: [String], description: "Temp filenames in display order" })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tempFiles?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  shadeId?: string;
}

class UpdateProductDto {
  @ApiPropertyOptional({ example: "SKU-001" })
  @IsOptional()
  @IsString()
  sku?: string;

  @ApiPropertyOptional({ example: "Koleston Perfect" })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: "koleston-perfect" })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 490 })
  @IsOptional()
  @IsNumber()
  price?: number;

  @ApiPropertyOptional({ example: 450 })
  @IsOptional()
  @IsNumber()
  specialPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  stock?: number;

  @ApiPropertyOptional({ enum: ProductStatusDto })
  @IsOptional()
  @IsEnum(ProductStatusDto)
  status?: ProductStatusDto;

  @ApiPropertyOptional({ type: [OrderedImageItemDto], description: "Full ordered image list (existing + new temp)" })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderedImageItemDto)
  orderedImages?: OrderedImageItemDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  shadeId?: string | null;
}

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

const uploadDir = join(process.cwd(), "uploads", "products");

const multerOptions = {
  storage: diskStorage({
    destination: (_req: unknown, _file: unknown, cb: (err: Error | null, dest: string) => void) => {
      if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true });
      cb(null, uploadDir);
    },
    filename: (_req: unknown, file: Express.Multer.File, cb: (err: Error | null, name: string) => void) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${unique}${extname(file.originalname)}`);
    },
  }),
  fileFilter: (_req: unknown, file: Express.Multer.File, cb: (err: Error | null, ok: boolean) => void) => {
    if (/image\/(jpeg|png|webp|gif)/.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"), false);
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 },
};

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
    const { orderedImages, ...rest } = dto;
    return this.productsService.update(id, {
      ...rest,
      status: rest.status as ProductStatus | undefined,
      orderedImages: orderedImages as Parameters<typeof this.productsService.update>[1]["orderedImages"],
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

  @Post(":id/images")
  @ApiOperation({ summary: "Upload a single product image (direct)" })
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("file", multerOptions))
  uploadImage(@Param("id") id: string, @UploadedFile() file: Express.Multer.File) {
    return this.productsService.addImage(id, file);
  }

  @Delete(":id/images/:imageId")
  @ApiOperation({ summary: "Delete product image" })
  removeImage(@Param("id") id: string, @Param("imageId") imageId: string) {
    return this.productsService.removeImage(id, imageId);
  }
}
