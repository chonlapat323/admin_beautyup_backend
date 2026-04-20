import { existsSync, mkdirSync, unlinkSync } from "fs";
import { join } from "path";
import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ShadeGroupsService {
  constructor(private readonly prisma: PrismaService) {}

  private get appUrl() {
    return process.env.APP_URL || `http://localhost:${process.env.PORT ?? 3000}`;
  }

  private get shadeDir() {
    return join(process.cwd(), "uploads", "shades");
  }

  private deleteShadeImage(url: string) {
    try {
      const filename = url.split("/").pop();
      if (!filename) return;
      const filePath = join(this.shadeDir, filename);
      if (existsSync(filePath)) unlinkSync(filePath);
    } catch { /* ignore */ }
  }

  async listGroups(categoryId: string) {
    return this.prisma.shadeGroup.findMany({
      where: { categoryId },
      orderBy: { sortOrder: "asc" },
      include: { shades: { orderBy: { sortOrder: "asc" } } },
    });
  }

  async createGroup(categoryId: string, name: string, sortOrder?: number) {
    return this.prisma.shadeGroup.create({
      data: { categoryId, name, sortOrder: sortOrder ?? 0 },
      include: { shades: true },
    });
  }

  async findGroup(groupId: string) {
    const group = await this.prisma.shadeGroup.findUnique({ where: { id: groupId } });
    if (!group) throw new NotFoundException("Shade group not found.");
    return group;
  }

  async updateGroup(groupId: string, data: { name?: string; sortOrder?: number; isActive?: boolean }) {
    await this.findGroup(groupId);
    return this.prisma.shadeGroup.update({
      where: { id: groupId },
      data,
      include: { shades: { orderBy: { sortOrder: "asc" } } },
    });
  }

  async deleteGroup(groupId: string) {
    const group = await this.prisma.shadeGroup.findUnique({
      where: { id: groupId },
      include: { shades: true },
    });
    if (!group) throw new NotFoundException("Shade group not found.");
    for (const shade of group.shades) {
      if (shade.imageUrl) this.deleteShadeImage(shade.imageUrl);
    }
    return this.prisma.shadeGroup.delete({ where: { id: groupId } });
  }

  async addShade(groupId: string, name: string, sortOrder?: number) {
    await this.findGroup(groupId);
    return this.prisma.shade.create({
      data: { shadeGroupId: groupId, name, sortOrder: sortOrder ?? 0 },
    });
  }

  async findShade(shadeId: string) {
    const shade = await this.prisma.shade.findUnique({ where: { id: shadeId } });
    if (!shade) throw new NotFoundException("Shade not found.");
    return shade;
  }

  async updateShade(shadeId: string, data: { name?: string; sortOrder?: number; isActive?: boolean }) {
    await this.findShade(shadeId);
    return this.prisma.shade.update({ where: { id: shadeId }, data });
  }

  async uploadShadeImage(shadeId: string, file: Express.Multer.File) {
    const shade = await this.findShade(shadeId);
    if (shade.imageUrl) this.deleteShadeImage(shade.imageUrl);
    if (!existsSync(this.shadeDir)) mkdirSync(this.shadeDir, { recursive: true });
    const url = `${this.appUrl}/uploads/shades/${file.filename}`;
    return this.prisma.shade.update({ where: { id: shadeId }, data: { imageUrl: url } });
  }

  async deleteShade(shadeId: string) {
    const shade = await this.findShade(shadeId);
    if (shade.imageUrl) this.deleteShadeImage(shade.imageUrl);
    return this.prisma.shade.delete({ where: { id: shadeId } });
  }
}
