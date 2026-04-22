import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from "@nestjs/swagger";
import { CommissionStatus } from "@prisma/client";
import { IsArray, IsInt, IsOptional, IsString } from "class-validator";
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

class MarkPaidDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  ids!: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

@ApiTags("Commission")
@Controller("commissions")
export class CommissionController {
  constructor(private readonly commissionService: CommissionService) {}

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
  @ApiOperation({ summary: "Mark commissions as paid (bulk)" })
  markPaid(@Body() dto: MarkPaidDto) {
    return this.commissionService.markPaid(dto.ids, dto.note);
  }

  @Patch(":id/cancel")
  @ApiOperation({ summary: "Cancel a commission" })
  cancel(@Param("id") id: string) {
    return this.commissionService.cancel(id);
  }
}
