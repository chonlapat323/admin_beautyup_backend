import { existsSync, mkdirSync, renameSync, unlinkSync } from "fs";
import { join } from "path";
import { Injectable, Logger, NotFoundException, BadRequestException } from "@nestjs/common";
import { RedemptionStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { PushService } from "../notifications/push.service";
import { FlowAccountService } from "../flowaccount/flowaccount.service";

@Injectable()
export class RewardProductsService {
  private readonly logger = new Logger(RewardProductsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pushService: PushService,
    private readonly flowAccountService: FlowAccountService,
  ) {}

  private get appUrl(): string {
    return process.env.APP_URL || `http://localhost:${process.env.PORT ?? 3000}`;
  }

  private get rewardDir(): string {
    return join(process.cwd(), "uploads", "rewards");
  }

  private get tempDir(): string {
    return join(process.cwd(), "uploads", "temp");
  }

  private moveTempToReward(filename: string): string | null {
    if (!existsSync(this.rewardDir)) mkdirSync(this.rewardDir, { recursive: true });
    const src = join(this.tempDir, filename);
    const dest = join(this.rewardDir, filename);
    if (!existsSync(src)) return null;
    renameSync(src, dest);
    return `${this.appUrl}/uploads/rewards/${filename}`;
  }

  private deleteRewardImageFile(url: string): void {
    try {
      const filename = url.split("/").pop();
      if (!filename) return;
      const filePath = join(this.rewardDir, filename);
      if (existsSync(filePath)) unlinkSync(filePath);
    } catch {
      // ignore
    }
  }

  private async applyOrderedImages(rewardProductId: string, orderedImages: Array<{ kind: "existing" | "temp"; id?: string; filename?: string }>) {
    const existing = await this.prisma.rewardProductImage.findMany({ where: { rewardProductId } });
    const keptIds = new Set(
      orderedImages.filter((i): i is { kind: "existing"; id: string } => i.kind === "existing").map((i) => i.id),
    );

    // Delete removed images
    for (const img of existing) {
      if (!keptIds.has(img.id)) {
        this.deleteRewardImageFile(img.url);
        await this.prisma.rewardProductImage.delete({ where: { id: img.id } });
      }
    }

    // Upsert in order
    let firstUrl: string | undefined;
    for (let i = 0; i < orderedImages.length; i++) {
      const item = orderedImages[i];
      if (item.kind === "existing") {
        if (!item.id) continue;
        await this.prisma.rewardProductImage.update({ where: { id: item.id }, data: { sortOrder: i } });
        if (i === 0) firstUrl = existing.find((e) => e.id === item.id)?.url;
      } else {
        if (!item.filename) continue;
        const url = this.moveTempToReward(item.filename);
        if (!url) continue;
        await this.prisma.rewardProductImage.create({ data: { rewardProductId, url, sortOrder: i } });
        if (i === 0) firstUrl = url;
      }
    }

    // Sync imageUrl to first image for mobile compat
    if (firstUrl !== undefined) {
      await this.prisma.rewardProduct.update({ where: { id: rewardProductId }, data: { imageUrl: firstUrl } });
    } else if (orderedImages.length === 0) {
      await this.prisma.rewardProduct.update({ where: { id: rewardProductId }, data: { imageUrl: null } });
    }
  }

  private readonly IMAGE_INCLUDE = { images: { orderBy: { sortOrder: "asc" as const } } };

  async generateSku(): Promise<string> {
    const count = await this.prisma.rewardProduct.count();
    const seq = String(count + 1).padStart(3, "0");
    return `PNT-${seq}`;
  }

  findAll() {
    return this.prisma.rewardProduct.findMany({
      orderBy: { createdAt: "desc" },
      include: this.IMAGE_INCLUDE,
    });
  }

  async findOne(id: string) {
    const item = await this.prisma.rewardProduct.findUnique({
      where: { id },
      include: this.IMAGE_INCLUDE,
    });
    if (!item) throw new NotFoundException("ไม่พบสินค้าแลกแต้ม");
    return item;
  }

  async create(data: {
    name: string;
    description?: string;
    pointCost: number;
    stock: number;
    isActive?: boolean;
    tempFiles?: string[];
  }) {
    const { tempFiles, ...rest } = data;
    const product = await this.prisma.rewardProduct.create({ data: rest });

    if (tempFiles && tempFiles.length > 0) {
      await this.applyOrderedImages(
        product.id,
        tempFiles.map((f) => ({ kind: "temp" as const, filename: f })),
      );
    }

    const created = await this.findOne(product.id);

    // Sync to FlowAccount in background with price 0 — failure does not block create
    this.flowAccountService.createItem({
      sku: created.sku ?? created.id,
      name: created.name,
      price: 0,
      stock: created.stock,
    }).then(async (itemId) => {
      if (!itemId) return;
      this.logger.log(`FlowAccount item created: ${itemId} for reward product ${created.id}`);
      await this.prisma.rewardProduct.update({
        where: { id: created.id },
        data: { flowAccountItemId: itemId },
      });
    }).catch((err) => {
      this.logger.error(`FlowAccount item sync failed for reward product ${created.id}`, err);
    });

    return created;
  }

  async update(
    id: string,
    data: Partial<{
      name: string;
      description: string;
      pointCost: number;
      stock: number;
      isActive: boolean;
      orderedImages: Array<{ kind: "existing" | "temp"; id?: string; filename?: string }>;
    }>,
  ) {
    await this.findOne(id);
    const { orderedImages, ...rest } = data;

    if (Object.keys(rest).length > 0) {
      await this.prisma.rewardProduct.update({ where: { id }, data: rest });
    }

    if (orderedImages !== undefined) {
      await this.applyOrderedImages(id, orderedImages);
    }

    const updated = await this.findOne(id);

    if (updated.flowAccountItemId) {
      this.flowAccountService.updateItem(updated.flowAccountItemId, {
        sku: updated.sku ?? updated.id,
        name: updated.name,
        price: 0,
      }).catch((err) => {
        this.logger.error(`FlowAccount item update failed for reward product ${updated.id}`, err);
      });
    }

    return updated;
  }

  async remove(id: string) {
    const item = await this.findOne(id);
    // Delete image files from disk before removing the DB record.
    // (Cascade deletes the RewardProductImage rows, but not the actual files.)
    for (const img of item.images) {
      this.deleteRewardImageFile(img.url);
    }
    return this.prisma.rewardProduct.delete({ where: { id } });
  }

  async listActive() {
    return this.prisma.rewardProduct.findMany({
      where: { isActive: true, stock: { gt: 0 } },
      orderBy: { pointCost: "asc" },
      include: this.IMAGE_INCLUDE,
    });
  }

  async getRedemptions(from?: string, to?: string) {
    const where: Record<string, unknown> = {};
    if (from || to) {
      where.createdAt = {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to ? { lte: new Date(new Date(to).setHours(23, 59, 59, 999)) } : {}),
      };
    }
    return this.prisma.rewardRedemption.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        member: { select: { id: true, fullName: true, email: true, phone: true } },
        rewardProduct: { select: { id: true, name: true } },
      },
    });
  }

  async redeem(
    memberId: string,
    rewardProductId: string,
    shipping: { recipient: string; phone: string; address: string },
  ) {
    return this.prisma.$transaction(async (tx) => {
      // Re-read inside the transaction to prevent TOCTOU race condition:
      // concurrent redeems could both pass the checks outside and then double-decrement.
      const [member, product] = await Promise.all([
        tx.member.findUnique({ where: { id: memberId } }),
        tx.rewardProduct.findUnique({ where: { id: rewardProductId } }),
      ]);

      if (!product || !product.isActive) throw new NotFoundException("ไม่พบสินค้าแลกแต้ม");
      if (product.stock <= 0) throw new BadRequestException("สินค้าหมด");
      if (!member) throw new NotFoundException("ไม่พบสมาชิก");
      if (member.pointBalance < product.pointCost) throw new BadRequestException("แต้มไม่เพียงพอ");

      await tx.member.update({
        where: { id: memberId },
        data: { pointBalance: { decrement: product.pointCost } },
      });
      await tx.rewardProduct.update({
        where: { id: rewardProductId },
        data: { stock: { decrement: 1 } },
      });
      return tx.rewardRedemption.create({
        data: {
          memberId,
          rewardProductId,
          pointsSpent: product.pointCost,
          shippingRecipient: shipping.recipient,
          shippingPhone: shipping.phone,
          shippingAddress: shipping.address,
        },
      });
    });
  }

  async updateRedemptionStatus(
    id: string,
    status: RedemptionStatus,
    trackingNumber?: string,
  ) {
    const redemption = await this.prisma.rewardRedemption.findUnique({
      where: { id },
      include: { member: { select: { expoPushToken: true } } },
    });
    if (!redemption) throw new NotFoundException("ไม่พบรายการแลกแต้ม");

    // Auto-set SHIPPED when tracking number is provided — same behavior as orders
    const resolvedStatus: RedemptionStatus =
      trackingNumber?.trim() && status !== "DELIVERED" ? "SHIPPED" : status;

    const updated = await this.prisma.rewardRedemption.update({
      where: { id },
      data: {
        status: resolvedStatus,
        trackingNumber: trackingNumber?.trim() || undefined,
        statusUpdatedAt: new Date(),
      },
      include: {
        member: true,
        rewardProduct: true,
      },
    });

    const token = redemption.member.expoPushToken;
    if (token) {
      const notifications: Record<RedemptionStatus, { title: string; body: string }> = {
        PENDING: { title: "", body: "" },
        PREPARING: { title: "กำลังเตรียมพัสดุ 📦", body: "ของรางวัลของคุณกำลังถูกเตรียม" },
        SHIPPED: { title: "จัดส่งแล้ว 🚚", body: trackingNumber?.trim() ? `หมายเลขพัสดุ: ${trackingNumber.trim()}` : "อยู่ระหว่างการจัดส่ง" },
        DELIVERED: { title: "ส่งถึงแล้ว ✅", body: "ของรางวัลของคุณถึงปลายทางแล้ว" },
      };
      const notif = notifications[status];
      if (notif.title) {
        void this.pushService.send(token, notif.title, notif.body);
      }
    }

    return updated;
  }

  async getRedemptionById(id: string) {
    const redemption = await this.prisma.rewardRedemption.findUnique({
      where: { id },
      include: { member: true, rewardProduct: true },
    });
    if (!redemption) throw new NotFoundException("ไม่พบรายการแลกแต้ม");
    return redemption;
  }
}
