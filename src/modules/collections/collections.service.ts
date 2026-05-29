import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

function toSlug(name: string): string {
  const ascii = name.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  if (ascii) return ascii;
  // Thai / non-ASCII → encode as hex so slug is still unique and deterministic
  return `col-${Buffer.from(name.trim()).toString("hex").slice(0, 20)}`;
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
    try {
      return await this.prisma.collection.create({
        data: {
          name: data.name.trim(),
          slug,
          sortOrder: data.sortOrder ?? 0,
          categoryId: data.categoryId ?? null,
        },
        include: CATEGORY_SELECT,
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new ConflictException("ชื่อ Collection นี้มีอยู่แล้ว");
      }
      throw e;
    }
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

    try {
      return await this.prisma.collection.update({
        where: { id },
        data: updateData,
        include: CATEGORY_SELECT,
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new ConflictException("ชื่อ Collection นี้มีอยู่แล้ว");
      }
      throw e;
    }
  }

  async remove(id: string) {
    const col = await this.prisma.collection.findUnique({ where: { id } });
    if (!col) throw new NotFoundException("ไม่พบ Collection");
    return this.prisma.collection.delete({ where: { id } });
  }
}
