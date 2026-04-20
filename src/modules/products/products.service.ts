import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, ProductStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

type ProductListParams = {
  search?: string;
  status?: "all" | "active" | "inactive" | "draft";
  page: number;
  pageSize: number;
};

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(params: ProductListParams) {
    const where: Prisma.ProductWhereInput = {};

    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: "insensitive" } },
        { sku: { contains: params.search, mode: "insensitive" } },
      ];
    }

    if (params.status === "active") {
      where.status = ProductStatus.ACTIVE;
    } else if (params.status === "inactive") {
      where.status = ProductStatus.INACTIVE;
    } else if (params.status === "draft") {
      where.status = ProductStatus.DRAFT;
    }

    const [items, totalItems] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
        include: {
          category: { select: { id: true, name: true } },
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

  create(payload: {
    sku: string;
    name: string;
    slug: string;
    description?: string;
    price: number;
    specialPrice?: number;
    categoryId: string;
    stock?: number;
    status?: ProductStatus;
  }) {
    return this.prisma.product.create({
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
      include: {
        category: { select: { id: true, name: true } },
      },
    });
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id },
      include: {
        category: { select: { id: true, name: true } },
      },
    });

    if (!product) {
      throw new NotFoundException("Product not found.");
    }

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
    },
  ) {
    await this.findOne(id);

    return this.prisma.product.update({
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
      include: {
        category: { select: { id: true, name: true } },
      },
    });
  }

  async updateStatus(id: string, status: ProductStatus) {
    await this.findOne(id);

    return this.prisma.product.update({
      where: { id },
      data: { status },
      include: {
        category: { select: { id: true, name: true } },
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.product.delete({ where: { id } });
  }
}
