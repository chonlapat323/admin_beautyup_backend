import { Body, Controller, Get, Param, Patch, Post, Put, Query } from "@nestjs/common";
import { ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from "@nestjs/swagger";
import { CommissionStatus } from "@prisma/client";
import { IsArray, IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, Min } from "class-validator";
import { Type } from "class-transformer";
import { CommissionService } from "./commission.service";

class ListCommissionsQueryDto {
  @ApiPropertyOptional({ enum: CommissionStatus })
  @IsOptional()
  @IsString()
  status?: CommissionStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  earnerId?: string;

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

class UpdateRatesDto {
  @ApiProperty({ description: "SALON rate (%)", example: 10 })
  @IsNumber()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  salon!: number;

  @ApiProperty({ description: "REGULAR rate (%)", example: 5 })
  @IsNumber()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  regular!: number;
}

class MarkPaidDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  ids!: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ example: "BANK_TRANSFER" })
  @IsOptional()
  @IsString()
  method?: string;

  @ApiPropertyOptional({ description: "Bank ref / slip number" })
  @IsOptional()
  @IsString()
  reference?: string;
}

class ListPayoutsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  memberId?: string;

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

@ApiTags("Commission")
@Controller("commissions")
export class CommissionController {
  constructor(private readonly commissionService: CommissionService) {}

  @Get("report")
  @ApiOperation({ summary: "Commission report grouped by period with optional date range" })
  report(
    @Query("period") period: "day" | "week" | "month" = "day",
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    const valid = ["day", "week", "month"];
    return this.commissionService.report(valid.includes(period) ? period : "day", from, to);
  }

  @Get("settings")
  @ApiOperation({ summary: "Get commission rate settings" })
  getSettings() {
    return this.commissionService.getRates();
  }

  @Put("settings")
  @ApiOperation({ summary: "Update commission rate settings" })
  updateSettings(@Body() dto: UpdateRatesDto) {
    return this.commissionService.updateRates(dto.salon, dto.regular);
  }

  @Get()
  @ApiOperation({ summary: "List commissions" })
  findAll(@Query() query: ListCommissionsQueryDto) {
    return this.commissionService.findAll({
      status: query.status,
      earnerId: query.earnerId,
      page: query.page && query.page > 0 ? query.page : 1,
      pageSize: query.pageSize && query.pageSize > 0 ? query.pageSize : 20,
    });
  }

  @Get("summary/:earnerId")
  @ApiOperation({ summary: "Get commission summary for a member" })
  summary(@Param("earnerId") earnerId: string) {
    return this.commissionService.summary(earnerId);
  }

  @Post("pay")
  @ApiOperation({ summary: "Mark commissions as paid — creates a CommissionPayout log per earner" })
  markPaid(@Body() dto: MarkPaidDto) {
    return this.commissionService.markPaid(dto.ids, {
      note: dto.note,
      method: dto.method,
      reference: dto.reference,
    });
  }

  @Get("payouts")
  @ApiOperation({ summary: "List payout logs" })
  findPayouts(@Query() query: ListPayoutsQueryDto) {
    return this.commissionService.findPayouts({
      memberId: query.memberId,
      page: query.page && query.page > 0 ? query.page : 1,
      pageSize: query.pageSize && query.pageSize > 0 ? query.pageSize : 20,
    });
  }

  @Patch(":id/cancel")
  @ApiOperation({ summary: "Cancel a commission" })
  cancel(@Param("id") id: string) {
    return this.commissionService.cancel(id);
  }
}
