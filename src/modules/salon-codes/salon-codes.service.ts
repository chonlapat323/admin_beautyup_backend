import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class SalonCodesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.salonCode.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { members: true } } },
    });
  }

  async findOne(id: string) {
    const code = await this.prisma.salonCode.findUnique({
      where: { id },
      include: { _count: { select: { members: true } } },
    });
    if (!code) throw new NotFoundException("ไม่พบ Salon Code");
    return code;
  }

  async create(payload: {
    code: string;
    description?: string;
    usageLimit?: number | null;
    expiresAt?: string | null;
    isActive?: boolean;
  }) {
    const existing = await this.prisma.salonCode.findUnique({ where: { code: payload.code } });
    if (existing) throw new BadRequestException("Code นี้มีอยู่แล้ว");
    return this.prisma.salonCode.create({
      data: {
        code: payload.code.trim().toUpperCase(),
        description: payload.description,
        usageLimit: payload.usageLimit ?? null,
        expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : null,
        isActive: payload.isActive ?? true,
      },
      include: { _count: { select: { members: true } } },
    });
  }

  async update(
    id: string,
    payload: {
      description?: string;
      usageLimit?: number | null;
      expiresAt?: string | null;
      isActive?: boolean;
    },
  ) {
    await this.findOne(id);
    return this.prisma.salonCode.update({
      where: { id },
      data: {
        ...(payload.description !== undefined && { description: payload.description }),
        ...(payload.usageLimit !== undefined && { usageLimit: payload.usageLimit }),
        ...(payload.expiresAt !== undefined && { expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : null }),
        ...(payload.isActive !== undefined && { isActive: payload.isActive }),
      },
      include: { _count: { select: { members: true } } },
    });
  }

  async remove(id: string) {
    const sc = await this.findOne(id);
    if (sc._count.members > 0) throw new BadRequestException("ไม่สามารถลบ code ที่มีสมาชิกใช้งานแล้วได้");
    return this.prisma.salonCode.delete({ where: { id } });
  }

  async validate(code: string): Promise<{ id: string } | null> {
    const sc = await this.prisma.salonCode.findUnique({ where: { code: code.trim().toUpperCase() } });
    if (!sc || !sc.isActive) return null;
    if (sc.expiresAt && sc.expiresAt < new Date()) return null;
    if (sc.usageLimit !== null && sc.usedCount >= sc.usageLimit) return null;
    return { id: sc.id };
  }

  incrementUsed(id: string) {
    return this.prisma.salonCode.update({
      where: { id },
      data: { usedCount: { increment: 1 } },
    });
  }
}
