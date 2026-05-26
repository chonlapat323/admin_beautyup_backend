import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { AdminGuard } from "../auth/admin.guard";
import { BrandsService } from "./brands.service";

@Controller("brands")
@UseGuards(AdminGuard)
export class BrandsController {
  constructor(private readonly brandsService: BrandsService) {}

  @Get()
  findAll() { return this.brandsService.findAll(); }

  @Post()
  create(@Body() body: { name: string; sortOrder?: number }) {
    return this.brandsService.create(body);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() body: { name?: string; isActive?: boolean; sortOrder?: number }) {
    return this.brandsService.update(id, body);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.brandsService.remove(id);
  }
}
