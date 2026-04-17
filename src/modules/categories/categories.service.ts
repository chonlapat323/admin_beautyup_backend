import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

type CategoryListParams = {
  search?: string;
  status?: "all" | "active" | "inactive";
  page: number;
  pageSize: number;
};

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

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

  create(payload: {
    name: string;
    slug: string;
    description?: string;
    sortOrder?: number;
    isActive?: boolean;
    processedBy?: string;
  }) {
    return this.prisma.category.create({
      data: {
        name: payload.name,
        slug: payload.slug,
        description: payload.description,
        sortOrder: payload.sortOrder ?? 0,
        isActive: payload.isActive ?? true,
        processedBy: payload.processedBy ?? "system",
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

  async findOne(id: string) {
    const category = await this.prisma.category.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: {
        _count: {
          select: {
            products: true,
          },
        },
      },
    });

    if (!category) {
      throw new NotFoundException("Category not found.");
    }

    return category;
  }

  async update(
    id: string,
    payload: {
      name?: string;
      slug?: string;
      description?: string;
      sortOrder?: number;
      isActive?: boolean;
      processedBy?: string;
    },
  ) {
    await this.findOne(id);

    return this.prisma.category.update({
      where: { id },
      data: {
        name: payload.name,
        slug: payload.slug,
        description: payload.description,
        sortOrder: payload.sortOrder,
        isActive: payload.isActive,
        processedBy: payload.processedBy ?? "system",
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
