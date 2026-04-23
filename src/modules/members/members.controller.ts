import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsBoolean, IsEmail, IsEnum, IsInt, IsOptional, IsString } from "class-validator";

import { MembersService } from "./members.service";

class CreateMemberDto {
  @ApiProperty({ example: "Pao Chonlapat" })
  @IsString()
  fullName!: string;

  @ApiProperty({ example: "0812345678", required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ example: "member@beautyup.com", required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ example: "mem_000", required: false })
  @IsOptional()
  @IsString()
  referredById?: string;

  @ApiPropertyOptional({ enum: ["REGULAR", "SALON"], example: "REGULAR" })
  @IsOptional()
  @IsEnum(["REGULAR", "SALON"])
  memberType?: "REGULAR" | "SALON";
}

class UpdateMemberDto {
  @ApiPropertyOptional({ example: "Pao Chonlapat" })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiPropertyOptional({ enum: ["REGULAR", "SALON"], example: "REGULAR" })
  @IsOptional()
  @IsEnum(["REGULAR", "SALON"])
  memberType?: "REGULAR" | "SALON";
}

class CreateAddressDto {
  @ApiPropertyOptional({ example: "บ้าน" })
  @IsOptional()
  @IsString()
  label?: string;

  @ApiProperty({ example: "สมชาย ใจดี" })
  @IsString()
  recipient!: string;

  @ApiProperty({ example: "0812345678" })
  @IsString()
  phone!: string;

  @ApiProperty({ example: "123 ถ.สุขุมวิท" })
  @IsString()
  addressLine1!: string;

  @ApiPropertyOptional({ example: "ห้อง 101 อาคาร A" })
  @IsOptional()
  @IsString()
  addressLine2?: string;

  @ApiPropertyOptional({ example: "คลองเตย" })
  @IsOptional()
  @IsString()
  district?: string;

  @ApiPropertyOptional({ example: "กรุงเทพมหานคร" })
  @IsOptional()
  @IsString()
  province?: string;

  @ApiPropertyOptional({ example: "10110" })
  @IsOptional()
  @IsString()
  postalCode?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

class UpdateAddressDto {
  @ApiPropertyOptional() @IsOptional() @IsString() label?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() recipient?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() addressLine1?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() addressLine2?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() district?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() province?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() postalCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isDefault?: boolean;
}

class UpdateMemberStatusDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  isActive!: boolean;
}

class ListMembersQueryDto {
  @ApiPropertyOptional({ example: "Pao" })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: ["all", "active", "inactive"], example: "all" })
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

@ApiTags("Members")
@Controller("members")
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Get()
  @ApiOperation({ summary: "List members" })
  findAll(@Query() query: ListMembersQueryDto) {
    return this.membersService.findAll({
      search: query.search?.trim() || undefined,
      status: (query.status as "all" | "active" | "inactive") || "all",
      page: query.page && query.page > 0 ? query.page : 1,
      pageSize: query.pageSize && query.pageSize > 0 ? query.pageSize : 10,
    });
  }

  @Post()
  @ApiOperation({ summary: "Create member" })
  create(@Body() dto: CreateMemberDto) {
    return this.membersService.create(dto);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get member detail" })
  findOne(@Param("id") id: string) {
    return this.membersService.findOne(id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update member" })
  update(@Param("id") id: string, @Body() dto: UpdateMemberDto) {
    return this.membersService.update(id, dto);
  }

  @Patch(":id/status")
  @ApiOperation({ summary: "Update member status" })
  updateStatus(@Param("id") id: string, @Body() dto: UpdateMemberStatusDto) {
    return this.membersService.updateStatus(id, dto.isActive);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete member" })
  remove(@Param("id") id: string) {
    return this.membersService.remove(id);
  }

  // ─── Addresses ────────────────────────────────────────────────────────────────

  @Get(":id/addresses")
  @ApiOperation({ summary: "List addresses for member" })
  listAddresses(@Param("id") id: string) {
    return this.membersService.listAddresses(id);
  }

  @Post(":id/addresses")
  @ApiOperation({ summary: "Add address for member" })
  createAddress(@Param("id") id: string, @Body() dto: CreateAddressDto) {
    return this.membersService.createAddress(id, dto);
  }

  @Patch(":id/addresses/:aid")
  @ApiOperation({ summary: "Update address" })
  updateAddress(@Param("id") id: string, @Param("aid") aid: string, @Body() dto: UpdateAddressDto) {
    return this.membersService.updateAddress(id, aid, dto);
  }

  @Delete(":id/addresses/:aid")
  @ApiOperation({ summary: "Delete address" })
  deleteAddress(@Param("id") id: string, @Param("aid") aid: string) {
    return this.membersService.deleteAddress(id, aid);
  }

  @Patch(":id/addresses/:aid/default")
  @ApiOperation({ summary: "Set address as default" })
  setDefaultAddress(@Param("id") id: string, @Param("aid") aid: string) {
    return this.membersService.setDefaultAddress(id, aid);
  }
}
