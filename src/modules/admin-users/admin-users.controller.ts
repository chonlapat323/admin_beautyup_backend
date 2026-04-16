import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiOperation, ApiProperty, PartialType, ApiTags } from "@nestjs/swagger";
import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString, MinLength } from "class-validator";

import { AdminUsersService } from "./admin-users.service";

enum AdminRoleDto {
  SUPER_ADMIN = "SUPER_ADMIN",
  ADMIN = "ADMIN",
}

class CreateAdminUserDto {
  @ApiProperty({ example: "admin@beautyup.com" })
  @IsEmail()
  email!: string;

  @ApiProperty({ enum: AdminRoleDto, example: AdminRoleDto.ADMIN })
  @IsEnum(AdminRoleDto)
  role!: AdminRoleDto;

  @ApiProperty({ example: "P@ssw0rd123" })
  @IsString()
  @MinLength(6)
  password!: string;

  @ApiProperty({ example: "Main Store", required: false })
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

@ApiTags("Admin Users")
@Controller("admin-users")
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Get()
  @ApiOperation({ summary: "List admin users" })
  findAll() {
    return this.adminUsersService.findAll();
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
}
