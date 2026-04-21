import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiProperty, ApiPropertyOptional, PartialType, ApiTags } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsBoolean, IsInt, IsOptional, IsString } from "class-validator";

import { CategoriesService } from "./categories.service";

class CreateCategoryDto {
  @ApiProperty({ example: "Hair Color" })
  @IsString()
  name!: string;

  @ApiProperty({ example: "hair-color" })
  @IsString()
  slug!: string;

  @ApiPropertyOptional({ example: "Color Collection" })
  @IsOptional()
  @IsString()
  eyebrow?: string;

  @ApiPropertyOptional({ example: "Hair color collection" })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: "http://localhost:3000/uploads/categories/img.jpg" })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ description: "Temp filename from /uploads/temp upload" })
  @IsOptional()
  @IsString()
  tempImageFile?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  requiresShadeSelection?: boolean;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}

class UpdateCategoryStatusDto {
  @ApiProperty({ example: false })
  @IsBoolean()
  isActive!: boolean;
}

class ListCategoriesQueryDto {
  @ApiPropertyOptional({ example: "hair" })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: ["all", "active", "inactive"], example: "all" })
  @IsOptional()
  @IsString()
  status?: "all" | "active" | "inactive";

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  page?: number;

  @ApiPropertyOptional({ example: 10, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  pageSize?: number;
}

@ApiTags("Categories")
@Controller("categories")
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @ApiOperation({ summary: "List categories" })
  findAll(@Query() query: ListCategoriesQueryDto) {
    return this.categoriesService.findAll({
      search: query.search?.trim() || undefined,
      status:
        query.status === "active" || query.status === "inactive" || query.status === "all"
          ? query.status
          : "all",
      page: query.page && query.page > 0 ? query.page : 1,
      pageSize: query.pageSize && query.pageSize > 0 ? query.pageSize : 10,
    });
  }

  @Post()
  @ApiOperation({ summary: "Create category" })
  create(@Body() dto: CreateCategoryDto, @Headers("x-processed-by") processedBy?: string) {
    return this.categoriesService.create({ ...dto, processedBy });
  }

  @Get(":id")
  @ApiOperation({ summary: "Get category detail" })
  findOne(@Param("id") id: string) {
    return this.categoriesService.findOne(id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update category" })
  update(
    @Param("id") id: string,
    @Body() dto: UpdateCategoryDto,
    @Headers("x-processed-by") processedBy?: string,
  ) {
    return this.categoriesService.update(id, {
      ...dto,
      processedBy,
    });
  }

  @Patch(":id/status")
  @ApiOperation({ summary: "Change category status" })
  updateStatus(
    @Param("id") id: string,
    @Body() dto: UpdateCategoryStatusDto,
    @Headers("x-processed-by") processedBy?: string,
  ) {
    return this.categoriesService.updateStatus(id, dto.isActive, processedBy);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Soft delete category" })
  remove(@Param("id") id: string, @Headers("x-processed-by") processedBy?: string) {
    return this.categoriesService.remove(id, processedBy);
  }
}
