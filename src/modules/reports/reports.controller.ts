import { Controller, Get, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";
import { ReportsService } from "./reports.service";

class DateRangeQuery {
  @IsOptional() @IsString() dateFrom?: string;
  @IsOptional() @IsString() dateTo?: string;
}

@ApiTags("Reports")
@Controller("reports")
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get("dashboard")
  @ApiOperation({ summary: "Get dashboard report" })
  dashboard() {
    return this.reportsService.dashboard();
  }

  @Get("sales-by-store")
  @ApiOperation({ summary: "Get sales by store report" })
  salesByStore() {
    return this.reportsService.salesByStore();
  }

  @Get("inventory")
  @ApiOperation({ summary: "Get inventory report" })
  inventory() {
    return this.reportsService.inventory();
  }

  @Get("sales-by-product")
  @ApiOperation({ summary: "Sales revenue grouped by product (PAID orders)" })
  salesByProduct(@Query() query: DateRangeQuery) {
    return this.reportsService.salesByProduct({ dateFrom: query.dateFrom, dateTo: query.dateTo });
  }

  @Get("sales-by-member")
  @ApiOperation({ summary: "Sales revenue grouped by member (PAID orders)" })
  salesByMember(@Query() query: DateRangeQuery) {
    return this.reportsService.salesByMember({ dateFrom: query.dateFrom, dateTo: query.dateTo });
  }

  @Get("stock")
  @ApiOperation({ summary: "Current stock level for all products" })
  stock() {
    return this.reportsService.stockReport();
  }
}
