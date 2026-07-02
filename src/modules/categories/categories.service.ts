import { existsSync, mkdirSync, renameSync, unlinkSync } from "fs";
import { join } from "path";
import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { generateThumbFor, deleteThumbnailFor } from "../../utils/thumbnail";

type CategoryListParams = {
  search?: string;
  status?: "all" | "active" | "inactive";
  page: number;
  pageSize: number;
};

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  private get appUrl() {
    return process.env.APP_URL || `http://localhost:${process.env.PORT ?? 3000}`;
  }

  private moveTempToCategory(filename: string): string | null {
    const tempDir = join(process.cwd(), "uploads", "temp");
    const categoryDir = join(process.cwd(), "uploads", "categories");
    if (!existsSync(categoryDir)) mkdirSync(categoryDir, { recursive: true });
    const src = join(tempDir, filename);
    const dest = join(categoryDir, filename);
    if (!existsSync(src)) return null;
    renameSync(src, dest);
    return `${this.appUrl}/uploads/categories/${filename}`;
  }

  private deleteCategoryImageFile(url: string): void {
    try {
      const filename = url.split("/").pop();
      if (!filename) return;
      const filePath = join(process.cwd(), "uploads", "categories", filename);
      if (existsSync(filePath)) unlinkSync(filePath);
      deleteThumbnailFor("categories", filename);
    } catch { /* ignore */ }
  }

  async findAll(params: CategoryListParams) {
    const where: Prisma.CategoryWhereInput = {
      deletedAt: null,
    };

    if (params.search) {
      where.OR = [
        {
          name: {
            contains: params.search,
            mode: "insensitive",
          },
        },
        {
          slug: {
            contains: params.search,
            mode: "insensitive",
          },
        },
      ];
    }

    if (params.status === "active") {
      where.isActive = true;
    }

    if (params.status === "inactive") {
      where.isActive = false;
    }

    const [items, totalItems] = await this.prisma.$transaction([
      this.prisma.category.findMany({
        where,
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
        include: {
          _count: {
            select: {
              products: true,
            },
          },
        },
      }),
      this.prisma.category.count({ where }),
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
    name: string;
    slug: string;
    eyebrow?: string;
    description?: string;
    imageUrl?: string;
    tempImageFile?: string;
    brandId?: string;
    requiresShadeSelection?: boolean;
    sortOrder?: number;
    isActive?: boolean;
    processedBy?: string;
  }) {
    let imageUrl = payload.imageUrl;
    let thumbnailUrl: string | null = null;
    if (payload.tempImageFile) {
      const moved = this.moveTempToCategory(payload.tempImageFile);
      if (moved) {
        imageUrl = moved;
        const destPath = join(process.cwd(), "uploads", "categories", payload.tempImageFile);
        thumbnailUrl = await generateThumbFor(destPath, "categories", this.appUrl);
      }
    }

    return this.prisma.category.create({
      data: {
        name: payload.name,
        slug: payload.slug,
        eyebrow: payload.eyebrow,
        description: payload.description,
        imageUrl,
        thumbnailUrl,
        brandId: payload.brandId ?? null,
        requiresShadeSelection: payload.requiresShadeSelection ?? false,
        sortOrder: payload.sortOrder ?? 0,
        isActive: payload.isActive ?? true,
        processedBy: payload.processedBy ?? "system",
        processedAt: new Date(),
      },
      include: { _count: { select: { products: true } } },
    });
  }

  async findOne(id: string) {
    const category = await this.prisma.category.findFirst({
      where: { id, deletedAt: null },
      include: {
        _count: { select: { products: true } },
        shadeGroups: {
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
          include: { shades: { where: { isActive: true }, orderBy: { sortOrder: "asc" } } },
        },
      },
    });

    if (!category) throw new NotFoundException("Category not found.");
    return category;
  }

  async update(
    id: string,
    payload: {
      name?: string;
      slug?: string;
      eyebrow?: string;
      description?: string;
      imageUrl?: string;
      tempImageFile?: string;
      brandId?: string;
      requiresShadeSelection?: boolean;
      sortOrder?: number;
      isActive?: boolean;
      processedBy?: string;
    },
  ) {
    const existing = await this.findOne(id);

    let imageUrl: string | undefined = undefined;
    let thumbnailUrl: string | null | undefined = undefined;
    if (payload.tempImageFile) {
      const moved = this.moveTempToCategory(payload.tempImageFile);
      if (moved) {
        if (existing.imageUrl) this.deleteCategoryImageFile(existing.imageUrl);
        imageUrl = moved;
        const destPath = join(process.cwd(), "uploads", "categories", payload.tempImageFile);
        thumbnailUrl = await generateThumbFor(destPath, "categories", this.appUrl);
      }
    } else if (typeof payload.imageUrl === "string" && payload.imageUrl.length > 0) {
      imageUrl = payload.imageUrl;
    }

    return this.prisma.category.update({
      where: { id },
      data: {
        ...(payload.name !== undefined && { name: payload.name }),
        ...(payload.slug !== undefined && { slug: payload.slug }),
        ...(payload.eyebrow !== undefined && { eyebrow: payload.eyebrow }),
        ...(payload.description !== undefined && { description: payload.description }),
        ...(imageUrl !== undefined && { imageUrl }),
        ...(thumbnailUrl !== undefined && { thumbnailUrl }),
        ...("brandId" in payload && { brandId: payload.brandId ?? null }),
        ...(payload.requiresShadeSelection !== undefined && { requiresShadeSelection: payload.requiresShadeSelection }),
        ...(payload.sortOrder !== undefined && { sortOrder: payload.sortOrder }),
        ...(payload.isActive !== undefined && { isActive: payload.isActive }),
        processedBy: payload.processedBy ?? "system",
        processedAt: new Date(),
      },
      include: { _count: { select: { products: true } } },
    });
  }

  async updateStatus(id: string, isActive: boolean, processedBy?: string) {
    await this.findOne(id);

    return this.prisma.category.update({
      where: { id },
      data: {
        isActive,
        processedBy: processedBy ?? "system",
        processedAt: new Date(),
      },
      include: {
        _count: {
          select: {
            products: true,
          },
        },
      },
    });
  }

  async remove(id: string, processedBy?: string) {
    await this.findOne(id);

    return this.prisma.category.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isActive: false,
        processedBy: processedBy ?? "system",
        processedAt: new Date(),
      },
    });
  }
}
