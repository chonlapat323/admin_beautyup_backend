import { Body, Controller, Get, Put } from "@nestjs/common";
import { ApiOperation, ApiProperty, ApiTags } from "@nestjs/swagger";
import { IsNumber, IsOptional } from "class-validator";

import { SettingsService } from "./settings.service";

class UpdateSettingsDto {
  @ApiProperty({ example: 1000, required: false })
  @IsOptional()
  @IsNumber()
  freeShippingThreshold?: number;

  @ApiProperty({ example: 50, required: false })
  @IsOptional()
  @IsNumber()
  defaultShippingFee?: number;

  @ApiProperty({ example: 3000, required: false })
  @IsOptional()
  @IsNumber()
  pointThreshold?: number;

  @ApiProperty({ example: 300, required: false })
  @IsOptional()
  @IsNumber()
  earnedPoint?: number;
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
