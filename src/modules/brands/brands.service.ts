import { existsSync, mkdirSync, renameSync, unlinkSync } from "fs";
import { join } from "path";
import { Injectable, NotFoundException, ConflictException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { generateThumbFor, deleteThumbnailFor } from "../../utils/thumbnail";

function toSlug(name: string): string {
  const ascii = name.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  if (ascii) return ascii;
  return `brand-${Buffer.from(name.trim()).toString("hex").slice(0, 16)}`;
}

@Injectable()
export class BrandsService {
  constructor(private readonly prisma: PrismaService) {}

  private get appUrl(): string {
    return process.env.APP_URL || `http://localhost:${process.env.PORT ?? 3000}`;
  }

  private moveTempToBrand(filename: string): string | null {
    const tempDir = join(process.cwd(), "uploads", "temp");
    const brandDir = join(process.cwd(), "uploads", "brands");
    if (!existsSync(brandDir)) mkdirSync(brandDir, { recursive: true });
    const src = join(tempDir, filename);
    const dest = join(brandDir, filename);
    if (!existsSync(src)) return null;
    renameSync(src, dest);
    return `${this.appUrl}/uploads/brands/${filename}`;
  }

  private deleteBrandImageFile(url: string): void {
    try {
      const filename = url.split("/").pop();
      if (!filename) return;
      const filePath = join(process.cwd(), "uploads", "brands", filename);
      if (existsSync(filePath)) unlinkSync(filePath);
      deleteThumbnailFor("brands", filename);
    } catch { /* ignore */ }
  }

  async findAll() {
    return this.prisma.brand.findMany({ orderBy: { sortOrder: "asc" } });
  }

  async create(data: { name: string; sortOrder?: number; tempImageFile?: string; imageUrl?: string }) {
    const slug = toSlug(data.name);
    const existing = await this.prisma.brand.findUnique({ where: { slug } });
    if (existing) throw new ConflictException("Brand นี้มีอยู่แล้ว");
    let imageUrl = data.imageUrl;
    let thumbnailUrl: string | null = null;
    if (data.tempImageFile) {
      const moved = this.moveTempToBrand(data.tempImageFile);
      if (moved) {
        imageUrl = moved;
        const destPath = join(process.cwd(), "uploads", "brands", data.tempImageFile);
        thumbnailUrl = await generateThumbFor(destPath, "brands", this.appUrl);
      }
    }
    return this.prisma.brand.create({
      data: { name: data.name, slug, sortOrder: data.sortOrder ?? 0, imageUrl, thumbnailUrl },
    });
  }

  async update(id: string, data: { name?: string; isActive?: boolean; sortOrder?: number; tempImageFile?: string; imageUrl?: string }) {
    const brand = await this.prisma.brand.findUnique({ where: { id } });
    if (!brand) throw new NotFoundException("ไม่พบ Brand");
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) { updateData.name = data.name; updateData.slug = toSlug(data.name); }
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;
    if (data.tempImageFile) {
      const moved = this.moveTempToBrand(data.tempImageFile);
      if (moved) {
        if (brand.imageUrl) this.deleteBrandImageFile(brand.imageUrl);
        updateData.imageUrl = moved;
        const destPath = join(process.cwd(), "uploads", "brands", data.tempImageFile);
        updateData.thumbnailUrl = await generateThumbFor(destPath, "brands", this.appUrl);
      }
    } else if (typeof data.imageUrl === "string") {
      if (data.imageUrl === "") {
        if (brand.imageUrl) this.deleteBrandImageFile(brand.imageUrl);
        updateData.imageUrl = null;
        updateData.thumbnailUrl = null;
      } else {
        updateData.imageUrl = data.imageUrl;
      }
    }
    return this.prisma.brand.update({ where: { id }, data: updateData });
  }

  async reorder(items: { id: string; sortOrder: number }[]) {
    await this.prisma.$transaction(
      items.map((item) =>
        this.prisma.brand.update({ where: { id: item.id }, data: { sortOrder: item.sortOrder } }),
      ),
    );
    return this.findAll();
  }

  async remove(id: string) {
    const brand = await this.prisma.brand.findUnique({ where: { id } });
    if (!brand) throw new NotFoundException("ไม่พบ Brand");
    if (brand.imageUrl) this.deleteBrandImageFile(brand.imageUrl);
    return this.prisma.brand.delete({ where: { id } });
  }
}
