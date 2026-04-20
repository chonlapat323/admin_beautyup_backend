import { existsSync, unlinkSync } from "fs";
import { join } from "path";
import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ShadesService {
  constructor(private readonly prisma: PrismaService) {}

  private get appUrl(): string {
    return process.env.APP_URL || `http://localhost:${process.env.PORT ?? 3000}`;
  }

  private get shadeDir(): string {
    return join(process.cwd(), "uploads", "shades");
  }

  private deleteShadeImageFile(url: string): void {
    try {
      const filename = url.split("/").pop();
      if (!filename) return;
      const filePath = join(this.shadeDir, filename);
      if (existsSync(filePath)) unlinkSync(filePath);
    } catch {
      // ignore fs errors
    }
  }

  async findByCategory(categoryId: string) {
    return this.prisma.shade.findMany({
      where: { categoryId, isActive: true },
      orderBy: { sortOrder: "asc" },
    });
  }

  async findAll(categoryId: string) {
    return this.prisma.shade.findMany({
      where: { categoryId },
      orderBy: { sortOrder: "asc" },
    });
  }

  async create(payload: {
    categoryId: string;
    name: string;
    code: string;
    swatch: string;
    imageUrl?: string;
    sortOrder?: number;
  }) {
    return this.prisma.shade.create({
      data: {
        categoryId: payload.categoryId,
        name: payload.name,
        code: payload.code,
        swatch: payload.swatch,
        imageUrl: payload.imageUrl,
        sortOrder: payload.sortOrder ?? 0,
      },
    });
  }

  async findOne(id: string) {
    const shade = await this.prisma.shade.findUnique({ where: { id } });
    if (!shade) throw new NotFoundException("Shade not found.");
    return shade;
  }

  async update(
    id: string,
    payload: {
      name?: string;
      code?: string;
      swatch?: string;
      imageUrl?: string | null;
      sortOrder?: number;
      isActive?: boolean;
    },
  ) {
    await this.findOne(id);
    return this.prisma.shade.update({ where: { id }, data: payload });
  }

  async uploadImage(id: string, file: Express.Multer.File) {
    const shade = await this.findOne(id);
    if (shade.imageUrl) this.deleteShadeImageFile(shade.imageUrl);
    const url = `${this.appUrl}/uploads/shades/${file.filename}`;
    return this.prisma.shade.update({ where: { id }, data: { imageUrl: url } });
  }

  async remove(id: string) {
    const shade = await this.findOne(id);
    if (shade.imageUrl) this.deleteShadeImageFile(shade.imageUrl);
    return this.prisma.shade.delete({ where: { id } });
  }
}
