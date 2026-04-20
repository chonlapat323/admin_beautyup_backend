import { Controller, Get, Param } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { ShadesService } from "./shades.service";

@ApiTags("Shades")
@Controller("categories/:categoryId/shades")
export class ShadesController {
  constructor(private readonly shadesService: ShadesService) {}

  @Get()
  @ApiOperation({ summary: "List active shades for a category (mobile app)" })
  findAll(@Param("categoryId") categoryId: string) {
    return this.shadesService.findAllForCategory(categoryId);
  }
}
