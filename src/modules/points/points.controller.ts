import { Controller, Get, Param } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { PointsService } from "./points.service";

@ApiTags("Points")
@Controller("points")
export class PointsController {
  constructor(private readonly pointsService: PointsService) {}

  @Get("rules")
  @ApiOperation({ summary: "Get point rules" })
  rules() {
    return this.pointsService.rules();
  }

  @Get("members/:memberId/history")
  @ApiOperation({ summary: "Get member point history" })
  history(@Param("memberId") memberId: string) {
    return this.pointsService.history(memberId);
  }
}
