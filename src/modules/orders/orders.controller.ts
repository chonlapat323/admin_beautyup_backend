import { Body, Controller, Get, Param, Patch } from "@nestjs/common";
import { ApiOperation, ApiProperty, ApiTags } from "@nestjs/swagger";
import { IsEnum } from "class-validator";

import { OrdersService } from "./orders.service";

enum OrderStatusDto {
  PENDING = "PENDING",
  PAID = "PAID",
  PROCESSING = "PROCESSING",
  SHIPPED = "SHIPPED",
  DELIVERED = "DELIVERED",
  CANCELLED = "CANCELLED",
}

class UpdateOrderStatusDto {
  @ApiProperty({ enum: OrderStatusDto, example: OrderStatusDto.PROCESSING })
  @IsEnum(OrderStatusDto)
  status!: OrderStatusDto;
}

@ApiTags("Orders")
@Controller("orders")
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @ApiOperation({ summary: "List orders" })
  findAll() {
    return this.ordersService.findAll();
  }

  @Get(":id")
  @ApiOperation({ summary: "Get order detail" })
  findOne(@Param("id") id: string) {
    return this.ordersService.findOne(id);
  }

  @Patch(":id/status")
  @ApiOperation({ summary: "Update order status" })
  updateStatus(@Param("id") id: string, @Body() dto: UpdateOrderStatusDto) {
    return this.ordersService.updateStatus(id, dto.status);
  }
}
