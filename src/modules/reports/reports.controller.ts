import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { ReportsService } from "./reports.service";

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
}
