import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiProperty, ApiPropertyOptional, PartialType, ApiTags } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsBoolean, IsEmail, IsInt, IsOptional, IsString } from "class-validator";

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
}

class UpdateMemberDto extends PartialType(CreateMemberDto) {}

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
}
