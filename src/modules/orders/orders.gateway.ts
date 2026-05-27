import { OnGatewayInit, WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import { Server } from "socket.io";
import { OrdersService } from "./orders.service";

@WebSocketGateway({ cors: { origin: "*" } })
export class OrdersGateway implements OnGatewayInit {
  @WebSocketServer()
  server!: Server;

  constructor(private readonly ordersService: OrdersService) {}

  afterInit() {
    this.ordersService.orderEvents$.subscribe((data) => {
      this.server.emit("order:updated", data);
    });
  }
}
