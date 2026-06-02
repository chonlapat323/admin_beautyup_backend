import { Injectable, Logger } from "@nestjs/common";
import { Subject } from "rxjs";
import { AuditLogService } from "../audit-log/audit-log.service";
import { CommissionService } from "../commission/commission.service";
import { FlowAccountService } from "../flowaccount/flowaccount.service";
import { PrismaService } from "../prisma/prisma.service";
import { StockService } from "../stock/stock.service";

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  private readonly orderEventSubject = new Subject<{ orderId: string; event: string }>();
  readonly orderEvents$ = this.orderEventSubject.asObservable();

  constructor(
    private readonly prisma: PrismaService,
    private readonly commissionService: CommissionService,
    private readonly stockService: StockService,
    private readonly auditLog: AuditLogService,
    private readonly flowAccountService: FlowAccountService,
  ) {}

  async findAll() {
    return this.prisma.order.findMany({
      include: {
        member: { select: { fullName: true, email: true, phone: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }

  async findOne(id: string) {
    return this.prisma.order.findUnique({
      where: { id },
      include: {
        member: { select: { fullName: true, email: true, phone: true } },
        items: {
          include: {
            product: {
              select: {
                name: true,
                sku: true,
                images: { select: { url: true }, orderBy: { sortOrder: "asc" }, take: 1 },
              },
            },
          },
        },
        statusLogs: { orderBy: { createdAt: "desc" } },
      },
    });
  }

  async updateStatus(id: string, status: string, changedByName: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      select: { status: true, memberId: true, pointEarned: true },
    });
    if (!order) throw new Error("Order not found");

    const isFirstDelivered = status === "DELIVERED" && order.status !== "DELIVERED";
    const isFirstPaid = status === "PAID" && order.status !== "PAID";

    const awardPoints =
      isFirstDelivered &&
      order.pointEarned > 0 &&
      order.memberId !== null;

    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.order.update({
        where: { id },
        data: { status: status as never },
      });
      await tx.orderStatusLog.create({
        data: {
          orderId: id,
          fromStatus: order.status,
          toStatus: status as never,
          changedByName,
        },
      });
      if (awardPoints && order.memberId) {
        await tx.member.update({
          where: { id: order.memberId },
          data: { pointBalance: { increment: order.pointEarned } },
        });
      }
      if (isFirstPaid) {
        await this.stockService.decrementForOrder(id, tx);
      }
      return updatedOrder;
    });

    // Create commission when order is first marked as PAID
    if (isFirstPaid) {
      this.logger.log(`[Commission] triggering createForOrder for orderId=${id}`);
      try {
        const result = await this.commissionService.createForOrder(id);
        if (result) {
          this.logger.log(`[Commission] created id=${result.id} amount=${result.amount} earnerId=${result.earnerId}`);
        } else {
          this.logger.warn(`[Commission] skipped — order ${id} has no referrer`);
        }
      } catch (err) {
        this.logger.error(`[Commission] FAILED for order ${id}: ${String(err)}`);
      }
    }

    void this.auditLog.log({ adminEmail: changedByName, action: "order.status_change", entityType: "order", entityId: id, detail: JSON.stringify({ from: order.status, to: status }) });
    this.orderEventSubject.next({ orderId: id, event: "status_change" });
    return { message: "Order status updated.", id: updated.id, status: updated.status };
  }

  async updateTracking(id: string, trackingNumber: string, changedByName = "Admin") {
    const order = await this.prisma.order.findUnique({ where: { id }, select: { id: true, status: true } });
    if (!order) throw new Error("Order not found");

    const shouldShip = trackingNumber.trim() !== "" && order.status !== "SHIPPED";

    await this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id },
        data: {
          trackingNumber,
          ...(shouldShip ? { status: "SHIPPED" as never } : {}),
        },
      });
      if (shouldShip) {
        await tx.orderStatusLog.create({
          data: {
            orderId: id,
            fromStatus: order.status,
            toStatus: "SHIPPED" as never,
            changedByName,
          },
        });
      }
    });

    this.orderEventSubject.next({ orderId: id, event: "tracking_update" });
    return {
      message: "Tracking number updated.",
      id,
      trackingNumber,
      ...(shouldShip ? { status: "SHIPPED" } : {}),
    };
  }

  async updateNote(id: string, note: string | null) {
    const order = await this.prisma.order.findUnique({ where: { id }, select: { id: true } });
    if (!order) throw new Error("Order not found");
    await this.prisma.order.update({ where: { id }, data: { note: note ?? null } });
    return { message: "Note updated.", id, note };
  }

  async adminCreate(data: {
    memberId?: string | null;
    items: { productId: string; quantity: number }[];
    shippingName: string;
    shippingPhone: string;
    shippingAddr: string;
    note?: string;
    adminEmail: string;
  }) {
    const products = await this.prisma.product.findMany({
      where: { id: { in: data.items.map((i) => i.productId) } },
      select: { id: true, price: true, name: true, sku: true },
    });

    let subtotal = 0;
    const orderItems = data.items.map((item) => {
      const product = products.find((p) => p.id === item.productId);
      if (!product) throw new Error(`Product ${item.productId} not found`);
      const unitPrice = Number(product.price);
      const totalPrice = unitPrice * item.quantity;
      subtotal += totalPrice;
      return {
        productId: item.productId,
        quantity: item.quantity,
        unitPrice,
        totalPrice,
        name: product.name,
        sku: product.sku,
      };
    });

    const orderNumber = `ADM-${Date.now()}`;

    const order = await this.prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          orderNumber,
          memberId: data.memberId ?? null,
          status: "PROCESSING" as never,
          subtotalAmount: subtotal,
          shippingAmount: 0,
          gatewayFee: 0,
          discountAmount: subtotal,
          totalAmount: 0,
          pointEarned: 0,
          paymentMethod: "MANUAL",
          shippingName: data.shippingName,
          shippingPhone: data.shippingPhone,
          shippingAddr: data.shippingAddr,
          note: data.note ?? null,
          items: {
            create: orderItems.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice,
              name: item.name,
              sku: item.sku,
            })),
          },
        },
      });
      await tx.orderStatusLog.create({
        data: {
          orderId: created.id,
          fromStatus: "PENDING" as never,
          toStatus: "PROCESSING" as never,
          changedByName: data.adminEmail,
        },
      });
      await this.stockService.decrementForOrder(created.id, tx);
      return created;
    });

    void this.auditLog.log({
      adminEmail: data.adminEmail,
      action: "order.admin_create",
      entityType: "order",
      entityId: order.id,
      detail: JSON.stringify({ orderNumber, memberId: data.memberId ?? "INTERNAL" }),
    });

    // Sync to FlowAccount — event order บันทึกเป็นใบเสร็จ ยอด ฿0 (100% discount)
    this.syncEventOrderToFlowAccount(order.id, orderNumber, order.createdAt, subtotal, orderItems, data.shippingName, data.shippingPhone).catch((err) =>
      this.logger.error(`[FlowAccount event order sync] FAILED for order ${order.id}: ${String(err)}`),
    );

    this.orderEventSubject.next({ orderId: order.id, event: "new_order" });
    return { message: "Order created.", id: order.id, orderNumber: order.orderNumber };
  }

  private async syncEventOrderToFlowAccount(
    orderId: string,
    orderNumber: string,
    createdAt: Date,
    subtotal: number,
    items: { name: string; quantity: number; unitPrice: number; totalPrice: number }[],
    contactName: string,
    contactPhone?: string,
  ): Promise<void> {
    const result = await this.flowAccountService.createReceipt({
      orderNumber,
      orderId,
      publishedOn: new Date(createdAt).toISOString().slice(0, 10),
      contactId: null,
      contactName: contactName || "Beauty Up (Internal)",
      contactEmail: undefined,
      contactPhone: contactPhone,
      subtotal,
      grandTotal: 0, // 100% discount
      items: items.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        pricePerUnit: i.unitPrice,
        total: i.totalPrice,
      })),
    });

    if (result) {
      await this.prisma.order.update({
        where: { id: orderId },
        data: {
          flowAccountDocId: result.taxInvoiceId,
          flowAccountReceiptId: result.receiptId || null,
        },
      });
      this.logger.log(`[FlowAccount event order] SUCCESS taxInvoiceId=${result.taxInvoiceId} for order ${orderId}`);
    }
  }
}
