import { existsSync, mkdirSync, renameSync, unlinkSync } from "fs";
import { join } from "path";
import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class CarriersService {
  constructor(private readonly prisma: PrismaService) {}

  private get appUrl(): string {
    return process.env.APP_URL || `http://localhost:${process.env.PORT ?? 3000}`;
  }

  private moveTempToCarrier(filename: string): string | null {
    const tempDir = join(process.cwd(), "uploads", "temp");
    const destDir = join(process.cwd(), "uploads", "carriers");
    if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true });
    const src = join(tempDir, filename);
    const dest = join(destDir, filename);
    if (!existsSync(src)) return null;
    renameSync(src, dest);
    return `${this.appUrl}/uploads/carriers/${filename}`;
  }

  private deleteCarrierImageFile(url: string): void {
    try {
      const filename = url.split("/").pop();
      if (!filename) return;
      const filePath = join(process.cwd(), "uploads", "carriers", filename);
      if (existsSync(filePath)) unlinkSync(filePath);
    } catch { /* ignore */ }
  }

  findAll(activeOnly = false) {
    return this.prisma.carrier.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
  }

  async findOne(id: string) {
    const carrier = await this.prisma.carrier.findUnique({ where: { id } });
    if (!carrier) throw new NotFoundException("ไม่พบผู้ให้บริการขนส่ง");
    return carrier;
  }

  async create(data: {
    name: string;
    shortName: string;
    color?: string;
    textColor?: string;
    logoUrl?: string;
    tempImageFile?: string;
    trackingUrl?: string;
    sortOrder?: number;
  }) {
    const { tempImageFile, ...rest } = data;
    const logoUrl = tempImageFile
      ? (this.moveTempToCarrier(tempImageFile) ?? rest.logoUrl)
      : rest.logoUrl;
    return this.prisma.carrier.create({ data: { ...rest, logoUrl } });
  }

  async update(
    id: string,
    data: {
      name?: string;
      shortName?: string;
      color?: string;
      textColor?: string;
      logoUrl?: string;
      tempImageFile?: string;
      trackingUrl?: string;
      isActive?: boolean;
      sortOrder?: number;
    },
  ) {
    const carrier = await this.findOne(id);
    const { tempImageFile, ...rest } = data;
    let logoUrl = rest.logoUrl;
    if (tempImageFile) {
      const newUrl = this.moveTempToCarrier(tempImageFile);
      if (newUrl) {
        if (carrier.logoUrl) this.deleteCarrierImageFile(carrier.logoUrl);
        logoUrl = newUrl;
      }
    }
    return this.prisma.carrier.update({ where: { id }, data: { ...rest, logoUrl } });
  }

  async remove(id: string) {
    const carrier = await this.findOne(id);
    if (carrier.logoUrl) this.deleteCarrierImageFile(carrier.logoUrl);
    return this.prisma.carrier.delete({ where: { id } });
  }
}
