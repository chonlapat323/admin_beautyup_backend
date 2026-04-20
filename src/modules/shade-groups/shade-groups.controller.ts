import { existsSync, mkdirSync } from "fs";
import { extname, join } from "path";
import { diskStorage } from "multer";
import { Body, Controller, Delete, Get, Param, Patch, Post, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiConsumes, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from "@nestjs/swagger";
import { IsBoolean, IsInt, IsOptional, IsString, Min } from "class-validator";
import { Type } from "class-transformer";

import { ShadeGroupsService } from "./shade-groups.service";

class CreateShadeGroupDto {
  @ApiProperty() @IsString() name!: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) sortOrder?: number;
}

class UpdateShadeGroupDto {
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) sortOrder?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

class CreateShadeItemDto {
  @ApiProperty() @IsString() name!: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) sortOrder?: number;
}

class UpdateShadeItemDto {
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) sortOrder?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

const shadeUploadDir = join(process.cwd(), "uploads", "shades");
const multerOptions = {
  storage: diskStorage({
    destination: (_req: unknown, _file: unknown, cb: (err: Error | null, dest: string) => void) => {
      if (!existsSync(shadeUploadDir)) mkdirSync(shadeUploadDir, { recursive: true });
      cb(null, shadeUploadDir);
    },
    filename: (_req: unknown, file: Express.Multer.File, cb: (err: Error | null, name: string) => void) => {
      cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${extname(file.originalname)}`);
    },
  }),
  fileFilter: (_req: unknown, file: Express.Multer.File, cb: (err: Error | null, ok: boolean) => void) => {
    if (/image\/(jpeg|png|webp|gif)/.test(file.mimetype)) cb(null, true);
    else cb(new Error("Only image files are allowed"), false);
  },
  limits: { fileSize: 5 * 1024 * 1024 },
};

@ApiTags("Shade Groups")
@Controller("categories/:categoryId/shade-groups")
export class ShadeGroupsController {
  constructor(private readonly service: ShadeGroupsService) {}

  @Get()
  @ApiOperation({ summary: "List shade groups with shades" })
  listGroups(@Param("categoryId") categoryId: string) {
    return this.service.listGroups(categoryId);
  }

  @Post()
  @ApiOperation({ summary: "Create shade group" })
  createGroup(@Param("categoryId") categoryId: string, @Body() dto: CreateShadeGroupDto) {
    return this.service.createGroup(categoryId, dto.name, dto.sortOrder);
  }

  @Patch(":groupId")
  @ApiOperation({ summary: "Update shade group" })
  updateGroup(@Param("groupId") groupId: string, @Body() dto: UpdateShadeGroupDto) {
    return this.service.updateGroup(groupId, dto);
  }

  @Delete(":groupId")
  @ApiOperation({ summary: "Delete shade group and all its shades" })
  deleteGroup(@Param("groupId") groupId: string) {
    return this.service.deleteGroup(groupId);
  }

  @Post(":groupId/shades")
  @ApiOperation({ summary: "Add shade to group" })
  addShade(@Param("groupId") groupId: string, @Body() dto: CreateShadeItemDto) {
    return this.service.addShade(groupId, dto.name, dto.sortOrder);
  }

  @Patch(":groupId/shades/:shadeId")
  @ApiOperation({ summary: "Update shade" })
  updateShade(@Param("shadeId") shadeId: string, @Body() dto: UpdateShadeItemDto) {
    return this.service.updateShade(shadeId, dto);
  }

  @Post(":groupId/shades/:shadeId/image")
  @ApiOperation({ summary: "Upload shade image" })
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("file", multerOptions))
  uploadImage(@Param("shadeId") shadeId: string, @UploadedFile() file: Express.Multer.File) {
    return this.service.uploadShadeImage(shadeId, file);
  }

  @Delete(":groupId/shades/:shadeId")
  @ApiOperation({ summary: "Delete shade" })
  deleteShade(@Param("shadeId") shadeId: string) {
    return this.service.deleteShade(shadeId);
  }
}
