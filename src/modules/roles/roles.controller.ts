import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags, PartialType } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsArray, IsBoolean, IsInt, IsOptional, IsString, ValidateNested } from "class-validator";

import { MenuPermission, RolesService } from "./roles.service";

class MenuPermissionDto {
  @IsString()
  menu!: string;

  @IsString()
  label!: string;

  @IsBoolean()
  canView!: boolean;

  @IsBoolean()
  canEdit!: boolean;

  @IsBoolean()
  canDelete!: boolean;
}

class CreateRoleDto {
  @ApiProperty({ example: "แคชเชียร์" })
  @IsString()
  name!: string;

  @ApiProperty({ type: [MenuPermissionDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MenuPermissionDto)
  permissions?: MenuPermissionDto[];
}

class UpdateRoleDto extends PartialType(CreateRoleDto) {}

class UpdateRoleStatusDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  isActive!: boolean;
}

class ListRolesQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: ["all", "active", "inactive"] })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  page?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  pageSize?: number;
}

@ApiTags("Roles")
@Controller("roles")
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get("menus")
  @ApiOperation({ summary: "Get available menus for permission config" })
  getMenus() {
    return this.rolesService.getMenus();
  }

  @Get()
  @ApiOperation({ summary: "List roles" })
  findAll(@Query() query: ListRolesQueryDto) {
    return this.rolesService.findAll({
      search: query.search?.trim() || undefined,
      status: query.status || "all",
      page: query.page && query.page > 0 ? query.page : 1,
      pageSize: query.pageSize && query.pageSize > 0 ? query.pageSize : 20,
    });
  }

  @Post()
  @ApiOperation({ summary: "Create role" })
  create(@Body() dto: CreateRoleDto) {
    return this.rolesService.create({
      name: dto.name,
      permissions: (dto.permissions ?? []) as Partial<MenuPermission>[],
    });
  }

  @Get(":id")
  @ApiOperation({ summary: "Get role detail" })
  findOne(@Param("id") id: string) {
    return this.rolesService.findOne(id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update role" })
  update(@Param("id") id: string, @Body() dto: UpdateRoleDto) {
    return this.rolesService.update(id, {
      name: dto.name,
      permissions: dto.permissions as Partial<MenuPermission>[] | undefined,
    });
  }

  @Patch(":id/status")
  @ApiOperation({ summary: "Update role status" })
  updateStatus(@Param("id") id: string, @Body() dto: UpdateRoleStatusDto) {
    return this.rolesService.updateStatus(id, dto.isActive);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete role" })
  remove(@Param("id") id: string) {
    return this.rolesService.remove(id);
  }
}
