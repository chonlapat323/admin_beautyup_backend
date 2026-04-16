import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiOperation, ApiProperty, PartialType, ApiTags } from "@nestjs/swagger";
import { IsEmail, IsOptional, IsString } from "class-validator";

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

@ApiTags("Members")
@Controller("members")
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Get()
  @ApiOperation({ summary: "List members" })
  findAll() {
    return this.membersService.findAll();
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

  @Delete(":id")
  @ApiOperation({ summary: "Delete member" })
  remove(@Param("id") id: string) {
    return this.membersService.remove(id);
  }
}
