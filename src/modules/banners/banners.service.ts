import { existsSync, mkdirSync, unlinkSync } from "fs";
import { join } from "path";
import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class BannersService {
  constructor(private readonly prisma: PrismaService) {}

  private get appUrl(): string {
    return process.env.APP_URL || `http://localhost:${process.env.PORT ?? 3000}`;
  }

  private get bannerDir(): string {
    return join(process.cwd(), "uploads", "banners");
  }

  private ensureBannerDir(): void {
    if (!existsSync(this.bannerDir)) mkdirSync(this.bannerDir, { recursive: true });
  }

  private deleteImageFile(url?: string | null): void {
    if (!url) return;
    try {
      const filename = url.split("/").pop();
      if (!filename) return;
      const filePath = join(this.bannerDir, filename);
      if (existsSync(filePath)) unlinkSync(filePath);
    } catch {
      // ignore fs errors
    }
  }

  findAll(activeOnly = false) {
    return this.prisma.banner.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: { sortOrder: "asc" },
    });
  }

  async create(payload: {
    eyebrow: string;
    title: string;
    body?: string;
    tag?: string;
    buttonLabel?: string;
    linkType?: string;
    linkId?: string;
    sortOrder?: number;
  }) {
    const count = await this.prisma.banner.count();
    return this.prisma.banner.create({
      data: {
        eyebrow: payload.eyebrow,
        title: payload.title,
        body: payload.body,
        tag: payload.tag ?? null,
        buttonLabel: payload.buttonLabel ?? "Shop Now",
        linkType: payload.linkType ?? "none",
        linkId: payload.linkId ?? null,
        sortOrder: payload.sortOrder ?? count,
      },
    });
  }

  async update(
    id: string,
    payload: {
      eyebrow?: string;
      title?: string;
      body?: string;
      tag?: string | null;
      buttonLabel?: string;
      linkType?: string;
      linkId?: string | null;
      sortOrder?: number;
      isActive?: boolean;
    },
  ) {
    await this.findOne(id);
    return this.prisma.banner.update({ where: { id }, data: payload });
  }

  async uploadImage(id: string, file: Express.Multer.File) {
    const banner = await this.findOne(id);
    this.deleteImageFile(banner.imageUrl);
    this.ensureBannerDir();
    const url = `${this.appUrl}/uploads/banners/${file.filename}`;
    return this.prisma.banner.update({ where: { id }, data: { imageUrl: url } });
  }

  async reorder(items: { id: string; sortOrder: number }[]) {
    await Promise.all(
      items.map((item) =>
        this.prisma.banner.update({ where: { id: item.id }, data: { sortOrder: item.sortOrder } }),
      ),
    );
    return this.findAll();
  }

  async remove(id: string) {
    const banner = await this.findOne(id);
    this.deleteImageFile(banner.imageUrl);
    return this.prisma.banner.delete({ where: { id } });
  }

  async findOne(id: string) {
    const banner = await this.prisma.banner.findFirst({ where: { id } });
    if (!banner) throw new NotFoundException("Banner not found.");
    return banner;
  }
}
