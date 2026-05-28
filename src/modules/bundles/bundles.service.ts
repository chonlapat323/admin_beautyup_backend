import { existsSync, mkdirSync, unlinkSync } from "fs";
import { join } from "path";
import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

const PRODUCT_SELECT = {
  id: true,
  name: true,
  sku: true,
  price: true,
  specialPrice: true,
  images: { select: { url: true }, orderBy: { sortOrder: "asc" as const }, take: 1 },
};

const ITEMS_INCLUDE = {
  include: {
    product: { select: PRODUCT_SELECT },
  },
};

@Injectable()
export class BundlesService {
  constructor(private readonly prisma: PrismaService) {}

  private get appUrl(): string {
    return process.env.APP_URL || `http://localhost:${process.env.PORT ?? 3000}`;
  }

  private get bundleDir(): string {
    return join(process.cwd(), "uploads", "bundles");
  }

  private ensureBundleDir(): void {
    if (!existsSync(this.bundleDir)) mkdirSync(this.bundleDir, { recursive: true });
  }

  private deleteImageFile(url?: string | null): void {
    if (!url) return;
    try {
      const filename = url.split("/").pop();
      if (!filename) return;
      const filePath = join(this.bundleDir, filename);
      if (existsSync(filePath)) unlinkSync(filePath);
    } catch {
      // ignore fs errors
    }
  }

  findAll(activeOnly = false) {
    return this.prisma.bundle.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      include: { items: ITEMS_INCLUDE },
      orderBy: { sortOrder: "asc" },
    });
  }

  async findOne(id: string) {
    const bundle = await this.prisma.bundle.findFirst({
      where: { id },
      include: { items: ITEMS_INCLUDE },
    });
    if (!bundle) throw new NotFoundException("Bundle not found.");
    return bundle;
  }

  async create(payload: {
    name: string;
    price: number;
    description?: string;
    sortOrder?: number;
    items?: { productId: string; quantity: number }[];
  }) {
    const count = await this.prisma.bundle.count();
    const bundle = await this.prisma.bundle.create({
      data: {
        name: payload.name,
        price: payload.price,
        description: payload.description,
        sortOrder: payload.sortOrder ?? count,
      },
    });
    if (payload.items && payload.items.length > 0) {
      await this.prisma.bundleItem.createMany({
        data: payload.items.map((item) => ({
          bundleId: bundle.id,
          productId: item.productId,
          quantity: item.quantity,
        })),
      });
    }
    return this.findOne(bundle.id);
  }

  async update(
    id: string,
    payload: {
      name?: string;
      price?: number;
      description?: string;
      sortOrder?: number;
      isActive?: boolean;
      items?: { productId: string; quantity: number }[];
    },
  ) {
    await this.findOne(id);
    if (payload.items !== undefined) {
      await this.prisma.bundleItem.deleteMany({ where: { bundleId: id } });
      if (payload.items.length > 0) {
        await this.prisma.bundleItem.createMany({
          data: payload.items.map((item) => ({
            bundleId: id,
            productId: item.productId,
            quantity: item.quantity,
          })),
        });
      }
    }
    const { items: _items, ...fields } = payload;
    await this.prisma.bundle.update({ where: { id }, data: fields });
    return this.findOne(id);
  }

  async uploadImage(id: string, file: Express.Multer.File) {
    const bundle = await this.findOne(id);
    this.deleteImageFile(bundle.imageUrl);
    this.ensureBundleDir();
    const url = `${this.appUrl}/uploads/bundles/${file.filename}`;
    return this.prisma.bundle.update({ where: { id }, data: { imageUrl: url } });
  }

  async reorder(items: { id: string; sortOrder: number }[]) {
    await Promise.all(
      items.map((item) =>
        this.prisma.bundle.update({ where: { id: item.id }, data: { sortOrder: item.sortOrder } }),
      ),
    );
    return this.findAll();
  }

  async remove(id: string) {
    const bundle = await this.findOne(id);
    this.deleteImageFile(bundle.imageUrl);
    return this.prisma.bundle.delete({ where: { id } });
  }
}
