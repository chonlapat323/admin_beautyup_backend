import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { CarriersService } from "./carriers.service";

@Controller("carriers")
export class CarriersController {
  constructor(private readonly carriersService: CarriersService) {}

  @Get()
  findAll(@Query("activeOnly") activeOnly?: string) {
    return this.carriersService.findAll(activeOnly === "true");
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.carriersService.findOne(id);
  }

  @Post()
  create(
    @Body()
    body: {
      name: string;
      shortName: string;
      color?: string;
      textColor?: string;
      logoUrl?: string;
      tempImageFile?: string;
      trackingUrl?: string;
      sortOrder?: number;
    },
  ) {
    return this.carriersService.create(body);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body()
    body: {
      name?: string;
      shortName?: string;
      color?: string;
      textColor?: string;
      logoUrl?: string;
      tempImageFile?: string;
      trackingUrl?: string;
      isActive?: boolean;
      sortOrder?: number;
    },
  ) {
    return this.carriersService.update(id, body);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.carriersService.remove(id);
  }
}
