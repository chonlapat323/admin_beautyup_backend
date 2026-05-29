import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { CollectionsService } from "./collections.service";

@Controller("collections")
export class CollectionsController {
  constructor(private readonly collectionsService: CollectionsService) {}

  @Get()
  findAll() { return this.collectionsService.findAll(); }

  @Post()
  create(@Body() body: { name: string; sortOrder?: number; categoryId?: string | null }) {
    return this.collectionsService.create(body);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() body: { name?: string; isActive?: boolean; sortOrder?: number; categoryId?: string | null },
  ) {
    return this.collectionsService.update(id, body);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.collectionsService.remove(id);
  }
}
