import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ShadesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllForCategory(categoryId: string) {
    return this.prisma.shade.findMany({
      where: {
        shadeGroup: { categoryId, isActive: true },
        isActive: true,
      },
      include: {
        shadeGroup: { select: { id: true, name: true, sortOrder: true } },
      },
      orderBy: [{ shadeGroup: { sortOrder: "asc" } }, { sortOrder: "asc" }],
    });
  }
}
