import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class CarriersService {
  constructor(private readonly prisma: PrismaService) {}

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
    trackingUrl?: string;
    sortOrder?: number;
  }) {
    return this.prisma.carrier.create({ data });
  }

  async update(
    id: string,
    data: {
      name?: string;
      shortName?: string;
      color?: string;
      textColor?: string;
      logoUrl?: string;
      trackingUrl?: string;
      isActive?: boolean;
      sortOrder?: number;
    },
  ) {
    await this.findOne(id);
    return this.prisma.carrier.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.carrier.delete({ where: { id } });
  }
}
