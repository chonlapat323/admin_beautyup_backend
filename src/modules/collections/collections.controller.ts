import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { AdminGuard } from "../auth/admin.guard";
import { CollectionsService } from "./collections.service";

@Controller("collections")
@UseGuards(AdminGuard)
export class CollectionsController {
  constructor(private readonly collectionsService: CollectionsService) {}

  @Get()
  findAll() { return this.collectionsService.findAll(); }

  @Post()
  create(@Body() body: { name: string; sortOrder?: number }) {
    return this.collectionsService.create(body);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() body: { name?: string; isActive?: boolean; sortOrder?: number }) {
    return this.collectionsService.update(id, body);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.collectionsService.remove(id);
  }
}
