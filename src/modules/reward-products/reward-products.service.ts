import { existsSync, mkdirSync, renameSync, unlinkSync } from "fs";
import { join } from "path";
import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

type OrderedImageItem =
  | { kind: "existing"; id: string }
  | { kind: "temp"; filename: string };

@Injectable()
export class RewardProductsService {
  constructor(private readonly prisma: PrismaService) {}

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

  private async applyOrderedImages(rewardProductId: string, orderedImages: OrderedImageItem[]) {
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
        await this.prisma.rewardProductImage.update({ where: { id: item.id }, data: { sortOrder: i } });
        if (i === 0) firstUrl = existing.find((e) => e.id === item.id)?.url;
      } else {
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

    return this.findOne(product.id);
  }

  async update(
    id: string,
    data: Partial<{
      name: string;
      description: string;
      pointCost: number;
      stock: number;
      isActive: boolean;
      orderedImages: OrderedImageItem[];
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

    return this.findOne(id);
  }

  async remove(id: string) {
    await this.findOne(id);
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

  async redeem(memberId: string, rewardProductId: string) {
    const [member, product] = await Promise.all([
      this.prisma.member.findUnique({ where: { id: memberId } }),
      this.prisma.rewardProduct.findUnique({ where: { id: rewardProductId } }),
    ]);

    if (!product || !product.isActive) throw new NotFoundException("ไม่พบสินค้าแลกแต้ม");
    if (product.stock <= 0) throw new BadRequestException("สินค้าหมด");
    if (!member) throw new NotFoundException("ไม่พบสมาชิก");
    if (member.pointBalance < product.pointCost) throw new BadRequestException("แต้มไม่เพียงพอ");

    return this.prisma.$transaction(async (tx) => {
      await tx.member.update({
        where: { id: memberId },
        data: { pointBalance: { decrement: product.pointCost } },
      });
      await tx.rewardProduct.update({
        where: { id: rewardProductId },
        data: { stock: { decrement: 1 } },
      });
      return tx.rewardRedemption.create({
        data: { memberId, rewardProductId, pointsSpent: product.pointCost },
      });
    });
  }
}
