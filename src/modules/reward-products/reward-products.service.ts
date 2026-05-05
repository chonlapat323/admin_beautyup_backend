import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class RewardProductsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.rewardProduct.findMany({ orderBy: { createdAt: "desc" } });
  }

  async findOne(id: string) {
    const item = await this.prisma.rewardProduct.findUnique({ where: { id } });
    if (!item) throw new NotFoundException("ไม่พบสินค้าแลกแต้ม");
    return item;
  }

  create(data: { name: string; description?: string; imageUrl?: string; pointCost: number; stock: number; isActive?: boolean }) {
    return this.prisma.rewardProduct.create({ data });
  }

  async update(id: string, data: Partial<{ name: string; description: string; imageUrl: string; pointCost: number; stock: number; isActive: boolean }>) {
    await this.findOne(id);
    return this.prisma.rewardProduct.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.rewardProduct.delete({ where: { id } });
  }

  async listActive() {
    return this.prisma.rewardProduct.findMany({
      where: { isActive: true, stock: { gt: 0 } },
      orderBy: { pointCost: "asc" },
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
