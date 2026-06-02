import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiOperation, ApiProperty, ApiTags } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString } from "class-validator";

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

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  changedByName?: string;
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

  @Post("admin")
  @ApiOperation({ summary: "Admin create order (bypass payment, 100% discount)" })
  adminCreate(
    @Body()
    body: {
      memberId?: string;
      items: { productId: string; quantity: number }[];
      shippingName: string;
      shippingPhone: string;
      shippingAddr: string;
      note?: string;
      adminEmail?: string;
    },
  ) {
    return this.ordersService.adminCreate({
      ...body,
      adminEmail: body.adminEmail ?? "Admin",
    });
  }

  @Get(":id")
  @ApiOperation({ summary: "Get order detail" })
  findOne(@Param("id") id: string) {
    return this.ordersService.findOne(id);
  }

  @Patch(":id/status")
  @ApiOperation({ summary: "Update order status" })
  updateStatus(@Param("id") id: string, @Body() dto: UpdateOrderStatusDto) {
    return this.ordersService.updateStatus(id, dto.status, dto.changedByName ?? "Admin");
  }

  @Patch(":id/tracking")
  @ApiOperation({ summary: "Update tracking number" })
  updateTracking(@Param("id") id: string, @Body() dto: { trackingNumber: string; carrierId?: string; changedByName?: string }) {
    return this.ordersService.updateTracking(id, dto.trackingNumber ?? "", dto.changedByName ?? "Admin", dto.carrierId);
  }

  @Patch(":id/note")
  @ApiOperation({ summary: "Update order note" })
  updateNote(@Param("id") id: string, @Body() body: { note?: string | null }) {
    return this.ordersService.updateNote(id, body.note ?? null);
  }
}
