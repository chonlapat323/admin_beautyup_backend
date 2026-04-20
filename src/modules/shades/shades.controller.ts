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
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiConsumes, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from "@nestjs/swagger";
import { IsBoolean, IsHexColor, IsInt, IsOptional, IsString, Min } from "class-validator";
import { Type } from "class-transformer";

import { ShadesService } from "./shades.service";

class CreateShadeDto {
  @ApiProperty({ example: "13-NB" })
  @IsString()
  name!: string;

  @ApiProperty({ example: "NB" })
  @IsString()
  code!: string;

  @ApiProperty({ example: "#F3E5DA" })
  @IsHexColor()
  swatch!: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

class UpdateShadeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsHexColor()
  swatch?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

const shadeUploadDir = join(process.cwd(), "uploads", "shades");

const multerOptions = {
  storage: diskStorage({
    destination: (_req: unknown, _file: unknown, cb: (err: Error | null, dest: string) => void) => {
      if (!existsSync(shadeUploadDir)) mkdirSync(shadeUploadDir, { recursive: true });
      cb(null, shadeUploadDir);
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

@ApiTags("Shades")
@Controller("categories/:categoryId/shades")
export class ShadesController {
  constructor(private readonly shadesService: ShadesService) {}

  @Get()
  @ApiOperation({ summary: "List shades for a category" })
  findAll(@Param("categoryId") categoryId: string) {
    return this.shadesService.findAll(categoryId);
  }

  @Post()
  @ApiOperation({ summary: "Create shade" })
  create(@Param("categoryId") categoryId: string, @Body() dto: CreateShadeDto) {
    return this.shadesService.create({ ...dto, categoryId });
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update shade" })
  update(@Param("id") id: string, @Body() dto: UpdateShadeDto) {
    return this.shadesService.update(id, dto);
  }

  @Post(":id/image")
  @ApiOperation({ summary: "Upload shade image" })
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("file", multerOptions))
  uploadImage(@Param("id") id: string, @UploadedFile() file: Express.Multer.File) {
    return this.shadesService.uploadImage(id, file);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete shade" })
  remove(@Param("id") id: string) {
    return this.shadesService.remove(id);
  }
}
