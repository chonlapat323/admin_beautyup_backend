import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiProperty, ApiPropertyOptional, PartialType, ApiTags } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsBoolean, IsEmail, IsInt, IsOptional, IsString, MinLength } from "class-validator";

import { AdminUsersService } from "./admin-users.service";

class CreateAdminUserDto {
  @ApiProperty({ example: "admin@beautyup.com" })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: "P@ssw0rd123" })
  @IsString()
  @MinLength(6)
  password!: string;

  @ApiProperty({ example: "role_001", required: false })
  @IsOptional()
  @IsString()
  roleId?: string;

  @ApiProperty({ example: "สมชาย", required: false })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiProperty({ example: "ใจดี", required: false })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiProperty({ example: "store_001", required: false })
  @IsOptional()
  @IsString()
  storeId?: string;
}

class UpdateAdminUserDto extends PartialType(CreateAdminUserDto) {}

class UpdateAdminUserStatusDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  isActive!: boolean;
}

class ListAdminUsersQueryDto {
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

@ApiTags("Admin Users")
@Controller("admin-users")
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Get()
  @ApiOperation({ summary: "List admin users" })
  findAll(@Query() query: ListAdminUsersQueryDto) {
    return this.adminUsersService.findAll({
      search: query.search?.trim() || undefined,
      status: query.status || "all",
      page: query.page && query.page > 0 ? query.page : 1,
      pageSize: query.pageSize && query.pageSize > 0 ? query.pageSize : 10,
    });
  }

  @Post()
  @ApiOperation({ summary: "Create admin user" })
  create(@Body() dto: CreateAdminUserDto) {
    return this.adminUsersService.create(dto);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get admin user detail" })
  findOne(@Param("id") id: string) {
    return this.adminUsersService.findOne(id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update admin user" })
  update(@Param("id") id: string, @Body() dto: UpdateAdminUserDto) {
    return this.adminUsersService.update(id, dto);
  }

  @Patch(":id/status")
  @ApiOperation({ summary: "Update admin user status" })
  updateStatus(@Param("id") id: string, @Body() dto: UpdateAdminUserStatusDto) {
    return this.adminUsersService.updateStatus(id, dto.isActive);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete admin user" })
  remove(@Param("id") id: string) {
    return this.adminUsersService.remove(id);
  }
}
