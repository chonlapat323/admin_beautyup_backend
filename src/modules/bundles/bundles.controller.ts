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
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

import { BundlesService } from "./bundles.service";

class BundleItemInputDto {
  @ApiProperty() @IsString() productId!: string;
  @ApiProperty() @IsInt() @Min(1) quantity!: number;
}

class CreateBundleDto {
  @ApiProperty() @IsString() name!: string;
  @ApiProperty() @IsNumber() price!: number;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() sortOrder?: number;
  @ApiPropertyOptional({ type: [BundleItemInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BundleItemInputDto)
  items?: BundleItemInputDto[];
}

class UpdateBundleDto {
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() price?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() sortOrder?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiPropertyOptional({ type: [BundleItemInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BundleItemInputDto)
  items?: BundleItemInputDto[];
}

class ReorderItemDto {
  @ApiProperty() @IsString() id!: string;
  @ApiProperty() @IsInt() sortOrder!: number;
}

class ReorderBundleDto {
  @ApiProperty({ type: [ReorderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderItemDto)
  items!: ReorderItemDto[];
}

const uploadDir = join(process.cwd(), "uploads", "bundles");

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
    if (/image\/(jpeg|png|webp|gif)/.test(file.mimetype)) cb(null, true);
    else cb(new Error("Only image files are allowed"), false);
  },
  limits: { fileSize: 5 * 1024 * 1024 },
};

@ApiTags("Bundles")
@Controller("bundles")
export class BundlesController {
  constructor(private readonly bundlesService: BundlesService) {}

  @Get()
  @ApiOperation({ summary: "List bundles" })
  findAll(@Query("active") active?: string) {
    return this.bundlesService.findAll(active === "true");
  }

  @Post()
  @ApiOperation({ summary: "Create bundle" })
  create(@Body() dto: CreateBundleDto) {
    return this.bundlesService.create({
      ...dto,
      price: Number(dto.price),
    });
  }

  @Patch("reorder")
  @ApiOperation({ summary: "Reorder bundles" })
  reorder(@Body() dto: ReorderBundleDto) {
    return this.bundlesService.reorder(dto.items);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update bundle" })
  update(@Param("id") id: string, @Body() dto: UpdateBundleDto) {
    return this.bundlesService.update(id, {
      ...dto,
      price: dto.price !== undefined ? Number(dto.price) : undefined,
    });
  }

  @Post(":id/image")
  @ApiOperation({ summary: "Upload bundle image" })
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("file", multerOptions))
  uploadImage(@Param("id") id: string, @UploadedFile() file: Express.Multer.File) {
    return this.bundlesService.uploadImage(id, file);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete bundle" })
  remove(@Param("id") id: string) {
    return this.bundlesService.remove(id);
  }
}
