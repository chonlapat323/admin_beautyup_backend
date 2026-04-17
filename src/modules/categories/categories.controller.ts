import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiOperation, ApiProperty, PartialType, ApiTags } from "@nestjs/swagger";
import { IsBoolean, IsInt, IsOptional, IsString } from "class-validator";

import { CategoriesService } from "./categories.service";

class CreateCategoryDto {
  @ApiProperty({ example: "Hair Color" })
  @IsString()
  name!: string;

  @ApiProperty({ example: "hair-color" })
  @IsString()
  slug!: string;

  @ApiProperty({ example: "Hair color collection", required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 1, required: false })
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiProperty({ example: true, required: false })
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

@ApiTags("Categories")
@Controller("categories")
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @ApiOperation({ summary: "List categories" })
  findAll() {
    return this.categoriesService.findAll();
  }

  @Post()
  @ApiOperation({ summary: "Create category" })
  create(@Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(dto);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get category detail" })
  findOne(@Param("id") id: string) {
    return this.categoriesService.findOne(id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update category" })
  update(@Param("id") id: string, @Body() dto: UpdateCategoryDto) {
    return this.categoriesService.update(id, dto);
  }

  @Patch(":id/status")
  @ApiOperation({ summary: "Change category status" })
  updateStatus(@Param("id") id: string, @Body() dto: UpdateCategoryStatusDto) {
    return this.categoriesService.updateStatus(id, dto.isActive);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Soft delete category" })
  remove(@Param("id") id: string) {
    return this.categoriesService.remove(id);
  }
}
