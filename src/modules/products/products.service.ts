import { existsSync, mkdirSync, renameSync, unlinkSync } from "fs";
import { join } from "path";
import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Prisma, ProductStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { FlowAccountService } from "../flowaccount/flowaccount.service";

type ProductListParams = {
  search?: string;
  status?: "all" | "active" | "inactive" | "draft";
  categoryId?: string;
  shadeId?: string;
  isFeatured?: boolean;
  page: number;
  pageSize: number;
};

type OrderedImageItem =
  | { kind: "existing"; id: string }
  | { kind: "temp"; filename: string };

const IMAGE_INCLUDE = { images: { orderBy: { sortOrder: "asc" } } } as const;

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly flowAccountService: FlowAccountService,
  ) {}

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

  // Returns null if temp file doesn't exist (skips creating broken DB record)
  private moveTempToProduct(filename: string): string | null {
    this.ensureProductDir();
    const src = join(this.tempDir, filename);
    const dest = join(this.productDir, filename);
    if (!existsSync(src)) return null;
    renameSync(src, dest);
    return `${this.appUrl}/uploads/products/${filename}`;
  }

  private deleteProductImageFile(url: string): void {
    try {
      const filename = url.split("/").pop();
      if (!filename) return;
      const filePath = join(this.productDir, filename);
      if (existsSync(filePath)) unlinkSync(filePath);
    } catch {
      // ignore fs errors
    }
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

    if (params.categoryId) where.categoryId = params.categoryId;
    if (params.shadeId) where.shadeId = params.shadeId;
    if (params.isFeatured === true) where.isFeatured = true;

    const [items, totalItems] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
        include: {
          category: { select: { id: true, name: true } },
          shade: { select: { id: true, name: true } },
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
    shadeId?: string;
    stock?: number;
    status?: ProductStatus;
    isFeatured?: boolean;
    tag?: string;
    tempFiles?: string[];
  }) {
    const stock = payload.stock ?? 0;
    const reserveStock = Math.ceil(stock * 0.1);
    const sellableStock = stock - reserveStock;

    const product = await this.prisma.product.create({
      data: {
        sku: payload.sku,
        name: payload.name,
        slug: payload.slug,
        description: payload.description,
        price: payload.price,
        specialPrice: payload.specialPrice ?? null,
        categoryId: payload.categoryId,
        shadeId: payload.shadeId ?? null,
        stock,
        reserveStock,
        sellableStock,
        status: payload.status ?? ProductStatus.DRAFT,
        isFeatured: payload.isFeatured ?? false,
        tag: payload.tag ?? null,
      },
    });

    if (payload.tempFiles && payload.tempFiles.length > 0) {
      let sortOrder = 0;
      for (const filename of payload.tempFiles) {
        const url = this.moveTempToProduct(filename);
        if (!url) continue; // skip if temp file missing
        await this.prisma.productImage.create({ data: { productId: product.id, url, sortOrder } });
        sortOrder++;
      }
    }

    const created = await this.findOne(product.id);

    // sync to FlowAccount in background — failure does not block create
    this.flowAccountService.createItem({
      sku: created.sku,
      name: created.name,
      price: Number(created.specialPrice ?? created.price),
      stock: created.stock,
      categoryName: created.category?.name ?? null,
    }).then(async (itemId) => {
      if (!itemId) return;
      this.logger.log(`FlowAccount item created: ${itemId} for product ${created.id}`);
      await this.prisma.product.update({
        where: { id: created.id },
        data: { flowAccountItemId: itemId },
      });
    }).catch((err) => {
      this.logger.error(`FlowAccount item sync failed for product ${created.id}`, err);
    });

    return created;
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id },
      include: {
        category: { select: { id: true, name: true } },
        shade: { select: { id: true, name: true, shadeGroupId: true } },
        ...IMAGE_INCLUDE,
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
      shadeId?: string | null;
      stock?: number;
      status?: ProductStatus;
      isFeatured?: boolean;
      tag?: string | null;
      orderedImages?: OrderedImageItem[];
    },
  ) {
    await this.findOne(id);

    const stockFields =
      payload.stock !== undefined
        ? {
            stock: payload.stock,
            reserveStock: Math.ceil(payload.stock * 0.1),
            sellableStock: payload.stock - Math.ceil(payload.stock * 0.1),
          }
        : {};

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
        shadeId: payload.shadeId,
        status: payload.status,
        isFeatured: payload.isFeatured,
        tag: payload.tag,
        ...stockFields,
      },
    });

    if (payload.orderedImages !== undefined) {
      await this.applyOrderedImages(id, payload.orderedImages);
    }

    const updated = await this.findOne(id);

    if (updated.flowAccountItemId) {
      this.flowAccountService.updateItem(updated.flowAccountItemId, {
        sku: updated.sku,
        name: updated.name,
        price: Number(updated.specialPrice ?? updated.price),
        categoryName: updated.category?.name ?? null,
      }).catch((err) => {
        this.logger.error(`FlowAccount item update failed for product ${updated.id}`, err);
      });
    }

    return updated;
  }

  private async applyOrderedImages(productId: string, ordered: OrderedImageItem[]) {
    const existing = await this.prisma.productImage.findMany({ where: { productId } });
    const keepIds = new Set(
      ordered.filter((i): i is { kind: "existing"; id: string } => i.kind === "existing").map((i) => i.id),
    );

    // Delete images removed from the list (file + DB record)
    for (const img of existing) {
      if (!keepIds.has(img.id)) {
        this.deleteProductImageFile(img.url);
        await this.prisma.productImage.delete({ where: { id: img.id } });
      }
    }

    // Apply order: update existing sortOrder + move new temp files
    let sortOrder = 0;
    for (const item of ordered) {
      if (item.kind === "existing") {
        await this.prisma.productImage.update({ where: { id: item.id }, data: { sortOrder } });
        sortOrder++;
      } else {
        const url = this.moveTempToProduct(item.filename);
        if (!url) continue; // skip if temp file missing
        await this.prisma.productImage.create({ data: { productId, url, sortOrder } });
        sortOrder++;
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
        ...IMAGE_INCLUDE,
      },
    });
  }

  async remove(id: string) {
    const product = await this.findOne(id);

    const orderCount = await this.prisma.orderItem.count({ where: { productId: id } });
    if (orderCount > 0) {
      throw new BadRequestException("ไม่สามารถลบสินค้าที่มีคำสั่งซื้อแล้วได้");
    }

    for (const img of product.images) {
      this.deleteProductImageFile(img.url);
    }

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
    this.deleteProductImageFile(image.url);
    await this.prisma.productImage.delete({ where: { id: imageId } });
    return { message: "Image deleted" };
  }
}
