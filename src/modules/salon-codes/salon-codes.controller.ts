import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from "@nestjs/swagger";
import { IsBoolean, IsInt, IsOptional, IsString, Min } from "class-validator";
import { Type } from "class-transformer";
import { SalonCodesService } from "./salon-codes.service";

class CreateSalonCodeDto {
  @ApiProperty({ example: "SALON2025" })
  @IsString()
  code!: string;

  @ApiPropertyOptional({ example: "แจกในงาน expo 2025" })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  usageLimit?: number | null;

  @ApiPropertyOptional({ example: "2025-12-31" })
  @IsOptional()
  @IsString()
  expiresAt?: string | null;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

class UpdateSalonCodeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  usageLimit?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  expiresAt?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

@ApiTags("Salon Codes")
@Controller("salon-codes")
export class SalonCodesController {
  constructor(private readonly salonCodesService: SalonCodesService) {}

  @Get()
  @ApiOperation({ summary: "List all salon codes" })
  findAll() {
    return this.salonCodesService.findAll();
  }

  @Post()
  @ApiOperation({ summary: "Create salon code" })
  create(@Body() dto: CreateSalonCodeDto) {
    return this.salonCodesService.create(dto);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update salon code" })
  update(@Param("id") id: string, @Body() dto: UpdateSalonCodeDto) {
    return this.salonCodesService.update(id, dto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete salon code" })
  remove(@Param("id") id: string) {
    return this.salonCodesService.remove(id);
  }
}
