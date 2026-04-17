import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.category.findMany({
      where: {
        deletedAt: null,
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      include: {
        _count: {
          select: {
            products: true,
          },
        },
      },
    });
  }

  create(payload: {
    name: string;
    slug: string;
    description?: string;
    sortOrder?: number;
    isActive?: boolean;
  }) {
    return this.prisma.category.create({
      data: {
        name: payload.name,
        slug: payload.slug,
        description: payload.description,
        sortOrder: payload.sortOrder ?? 0,
        isActive: payload.isActive ?? true,
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

  async updateStatus(id: string, isActive: boolean) {
    await this.findOne(id);

    return this.prisma.category.update({
      where: { id },
      data: { isActive },
      include: {
        _count: {
          select: {
            products: true,
          },
        },
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.category.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isActive: false,
      },
    });
  }
}
