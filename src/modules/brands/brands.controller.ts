import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { BrandsService } from "./brands.service";

@Controller("brands")
export class BrandsController {
  constructor(private readonly brandsService: BrandsService) {}

  @Get()
  findAll() { return this.brandsService.findAll(); }

  @Post()
  create(@Body() body: { name: string; sortOrder?: number; tempImageFile?: string; imageUrl?: string }) {
    return this.brandsService.create(body);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() body: { name?: string; isActive?: boolean; sortOrder?: number; tempImageFile?: string; imageUrl?: string },
  ) {
    return this.brandsService.update(id, body);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.brandsService.remove(id);
  }
}
