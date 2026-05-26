import { Injectable, NotFoundException, ConflictException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

function toSlug(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

const CATEGORY_SELECT = { category: { select: { id: true, name: true } } } as const;

@Injectable()
export class CollectionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.collection.findMany({
      orderBy: { sortOrder: "asc" },
      include: CATEGORY_SELECT,
    });
  }

  async create(data: { name: string; sortOrder?: number; categoryId?: string | null }) {
    const slug = toSlug(data.name);
    const existing = await this.prisma.collection.findUnique({ where: { slug } });
    if (existing) throw new ConflictException("Collection นี้มีอยู่แล้ว");
    return this.prisma.collection.create({
      data: {
        name: data.name,
        slug,
        sortOrder: data.sortOrder ?? 0,
        categoryId: data.categoryId ?? null,
      },
      include: CATEGORY_SELECT,
    });
  }

  async update(id: string, data: { name?: string; isActive?: boolean; sortOrder?: number; categoryId?: string | null }) {
    const col = await this.prisma.collection.findUnique({ where: { id } });
    if (!col) throw new NotFoundException("ไม่พบ Collection");

    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) {
      updateData.name = data.name;
      updateData.slug = toSlug(data.name);
    }
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;
    if ("categoryId" in data) updateData.categoryId = data.categoryId ?? null;

    return this.prisma.collection.update({
      where: { id },
      data: updateData,
      include: CATEGORY_SELECT,
    });
  }

  async remove(id: string) {
    const col = await this.prisma.collection.findUnique({ where: { id } });
    if (!col) throw new NotFoundException("ไม่พบ Collection");
    return this.prisma.collection.delete({ where: { id } });
  }
}
