import { Body, Controller, Get, Put } from "@nestjs/common";
import { ApiOperation, ApiProperty, ApiTags } from "@nestjs/swagger";
import { IsArray, IsInt, IsNumber, IsOptional, Min, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

import { SettingsService } from "./settings.service";

class PointTierDto {
  @ApiProperty({ example: 3000 }) @IsInt() @Min(0) minSpend!: number;
  @ApiProperty({ example: 300 }) @IsInt() @Min(0) points!: number;
}

class UpdateSettingsDto {
  @ApiProperty({ example: 1000, required: false })
  @IsOptional()
  @IsNumber()
  freeShippingThreshold?: number;

  @ApiProperty({ example: 50, required: false })
  @IsOptional()
  @IsNumber()
  defaultShippingFee?: number;

  @ApiProperty({ example: 20, required: false })
  @IsOptional()
  @IsNumber()
  gatewayFee?: number;

  @ApiProperty({
    type: [PointTierDto],
    required: false,
    example: [{ minSpend: 3000, points: 300 }, { minSpend: 5000, points: 500 }, { minSpend: 10000, points: 1000 }],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PointTierDto)
  pointTiers?: PointTierDto[];
}

@ApiTags("Settings")
@Controller("settings")
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @ApiOperation({ summary: "Get system settings" })
  getAll() {
    return this.settingsService.getAll();
  }

  @Put()
  @ApiOperation({ summary: "Update system settings" })
  update(@Body() dto: UpdateSettingsDto) {
    return this.settingsService.update(dto);
  }
}
