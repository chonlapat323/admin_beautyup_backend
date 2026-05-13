import { Controller, Get, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString } from "class-validator";
import { AuditLogService } from "./audit-log.service";

class AuditLogQueryDto {
  @IsOptional() @IsInt() @Type(() => Number) page?: number;
  @IsOptional() @IsInt() @Type(() => Number) limit?: number;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() entityType?: string;
  @IsOptional() @IsString() dateFrom?: string;
  @IsOptional() @IsString() dateTo?: string;
}

@ApiTags("Audit Log")
@Controller("audit-logs")
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  @ApiOperation({ summary: "Get audit log entries" })
  findAll(@Query() query: AuditLogQueryDto) {
    return this.auditLogService.findAll({
      page: query.page && query.page > 0 ? query.page : 1,
      limit: query.limit && query.limit > 0 ? query.limit : 50,
      search: query.search || undefined,
      entityType: query.entityType || undefined,
      dateFrom: query.dateFrom || undefined,
      dateTo: query.dateTo || undefined,
    });
  }
}
