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
import { IsArray, IsBoolean, IsInt, IsOptional, IsString, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

import { BannersService } from "./banners.service";

class CreateBannerDto {
  @ApiProperty() @IsString() eyebrow!: string;
  @ApiProperty() @IsString() title!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() body?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() buttonLabel?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() linkType?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() linkId?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() sortOrder?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

class UpdateBannerDto {
  @ApiPropertyOptional() @IsOptional() @IsString() eyebrow?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() body?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() buttonLabel?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() linkType?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() linkId?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsInt() sortOrder?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

class ReorderItemDto {
  @ApiProperty() @IsString() id!: string;
  @ApiProperty() @IsInt() sortOrder!: number;
}

class ReorderBannerDto {
  @ApiProperty({ type: [ReorderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderItemDto)
  items!: ReorderItemDto[];
}

const uploadDir = join(process.cwd(), "uploads", "banners");

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

@ApiTags("Banners")
@Controller("banners")
export class BannersController {
  constructor(private readonly bannersService: BannersService) {}

  @Get()
  @ApiOperation({ summary: "List banners" })
  findAll(@Query("active") active?: string) {
    return this.bannersService.findAll(active === "true");
  }

  @Post()
  @ApiOperation({ summary: "Create banner" })
  create(@Body() dto: CreateBannerDto) {
    return this.bannersService.create(dto);
  }

  @Patch("reorder")
  @ApiOperation({ summary: "Reorder banners" })
  reorder(@Body() dto: ReorderBannerDto) {
    return this.bannersService.reorder(dto.items);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update banner" })
  update(@Param("id") id: string, @Body() dto: UpdateBannerDto) {
    return this.bannersService.update(id, dto);
  }

  @Post(":id/image")
  @ApiOperation({ summary: "Upload banner image" })
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("file", multerOptions))
  uploadImage(@Param("id") id: string, @UploadedFile() file: Express.Multer.File) {
    return this.bannersService.uploadImage(id, file);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete banner" })
  remove(@Param("id") id: string) {
    return this.bannersService.remove(id);
  }
}
