import { existsSync, mkdirSync, renameSync, unlinkSync } from "fs";
import { join, extname } from "path";
import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, ProductStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

type ProductListParams = {
  search?: string;
  status?: "all" | "active" | "inactive" | "draft";
  page: number;
  pageSize: number;
};

type OrderedImageItem =
  | { kind: "existing"; id: string }
  | { kind: "temp"; filename: string };

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  private get appUrl(): string {
    return process.env.APP_URL || `http://localhost:${process.env.PORT ?? 3000}`;
  }

  private get productDir(): string {
    return join(process.cwd(), "uploads", "products");
  }

  private get tempDir(): string {
    return join(process.cwd(), "uploads", "temp");
  }

  private ensureProductDir(): void {
    if (!existsSync(this.productDir)) mkdirSync(this.productDir, { recursive: true });
  }

  private moveTempToProduct(filename: string): string {
    this.ensureProductDir();
    const src = join(this.tempDir, filename);
    const dest = join(this.productDir, filename);
    if (existsSync(src)) renameSync(src, dest);
    return `${this.appUrl}/uploads/products/${filename}`;
  }

  async findAll(params: ProductListParams) {
    const where: Prisma.ProductWhereInput = {};

    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: "insensitive" } },
        { sku: { contains: params.search, mode: "insensitive" } },
      ];
    }

    if (params.status === "active") where.status = ProductStatus.ACTIVE;
    else if (params.status === "inactive") where.status = ProductStatus.INACTIVE;
    else if (params.status === "draft") where.status = ProductStatus.DRAFT;

    const [items, totalItems] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
        include: {
          category: { select: { id: true, name: true } },
          images: { orderBy: { sortOrder: "asc" }, take: 1 },
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    const totalPages = Math.max(1, Math.ceil(totalItems / params.pageSize));

    return {
      items,
      meta: {
        page: params.page,
        pageSize: params.pageSize,
        totalItems,
        totalPages,
        hasNextPage: params.page < totalPages,
        hasPreviousPage: params.page > 1,
      },
    };
  }

  async create(payload: {
    sku: string;
    name: string;
    slug: string;
    description?: string;
    price: number;
    specialPrice?: number;
    categoryId: string;
    stock?: number;
    status?: ProductStatus;
    tempFiles?: string[];
  }) {
    const product = await this.prisma.product.create({
      data: {
        sku: payload.sku,
        name: payload.name,
        slug: payload.slug,
        description: payload.description,
        price: payload.price,
        specialPrice: payload.specialPrice ?? null,
        categoryId: payload.categoryId,
        stock: payload.stock ?? 0,
        status: payload.status ?? ProductStatus.DRAFT,
      },
    });

    if (payload.tempFiles && payload.tempFiles.length > 0) {
      for (let i = 0; i < payload.tempFiles.length; i++) {
        const url = this.moveTempToProduct(payload.tempFiles[i]);
        await this.prisma.productImage.create({
          data: { productId: product.id, url, sortOrder: i },
        });
      }
    }

    return this.findOne(product.id);
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id },
      include: {
        category: { select: { id: true, name: true } },
        images: { orderBy: { sortOrder: "asc" } },
      },
    });

    if (!product) throw new NotFoundException("Product not found.");
    return product;
  }

  async update(
    id: string,
    payload: {
      sku?: string;
      name?: string;
      slug?: string;
      description?: string;
      price?: number;
      specialPrice?: number | null;
      categoryId?: string;
      stock?: number;
      status?: ProductStatus;
      orderedImages?: OrderedImageItem[];
    },
  ) {
    await this.findOne(id);

    await this.prisma.product.update({
      where: { id },
      data: {
        sku: payload.sku,
        name: payload.name,
        slug: payload.slug,
        description: payload.description,
        price: payload.price,
        specialPrice: payload.specialPrice,
        categoryId: payload.categoryId,
        stock: payload.stock,
        status: payload.status,
      },
    });

    if (payload.orderedImages !== undefined) {
      await this.applyOrderedImages(id, payload.orderedImages);
    }

    return this.findOne(id);
  }

  private async applyOrderedImages(productId: string, ordered: OrderedImageItem[]) {
    const existing = await this.prisma.productImage.findMany({ where: { productId } });
    const keepIds = new Set(
      ordered.filter((i): i is { kind: "existing"; id: string } => i.kind === "existing").map((i) => i.id),
    );

    // Delete images no longer in the list (including file on disk)
    for (const img of existing) {
      if (!keepIds.has(img.id)) {
        try {
          const filename = img.url.split("/").pop();
          if (filename) {
            const filePath = join(this.productDir, filename);
            if (existsSync(filePath)) unlinkSync(filePath);
          }
        } catch {
          // ignore fs errors
        }
        await this.prisma.productImage.delete({ where: { id: img.id } });
      }
    }

    // Apply order: update existing sortOrder + create temp records
    for (let i = 0; i < ordered.length; i++) {
      const item = ordered[i];
      if (item.kind === "existing") {
        await this.prisma.productImage.update({
          where: { id: item.id },
          data: { sortOrder: i },
        });
      } else {
        const url = this.moveTempToProduct(item.filename);
        await this.prisma.productImage.create({
          data: { productId, url, sortOrder: i },
        });
      }
    }
  }

  async updateStatus(id: string, status: ProductStatus) {
    await this.findOne(id);
    return this.prisma.product.update({
      where: { id },
      data: { status },
      include: {
        category: { select: { id: true, name: true } },
        images: { orderBy: { sortOrder: "asc" }, take: 1 },
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.product.delete({ where: { id } });
  }

  async addImage(productId: string, file: Express.Multer.File) {
    await this.findOne(productId);
    const last = await this.prisma.productImage.findFirst({
      where: { productId },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    const url = `${this.appUrl}/uploads/products/${file.filename}`;
    return this.prisma.productImage.create({
      data: { productId, url, sortOrder: last ? last.sortOrder + 1 : 0 },
    });
  }

  async removeImage(productId: string, imageId: string) {
    const image = await this.prisma.productImage.findFirst({ where: { id: imageId, productId } });
    if (!image) throw new NotFoundException("Image not found.");

    try {
      const filename = image.url.split("/").pop();
      if (filename) {
        const filePath = join(this.productDir, filename);
        if (existsSync(filePath)) unlinkSync(filePath);
      }
    } catch {
      // ignore fs errors
    }

    await this.prisma.productImage.delete({ where: { id: imageId } });
    return { message: "Image deleted" };
  }
}
