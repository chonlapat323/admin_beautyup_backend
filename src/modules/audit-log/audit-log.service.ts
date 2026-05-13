import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

type LogEntry = {
  adminEmail: string;
  action: string;
  entityType: string;
  entityId: string;
  detail?: string;
};

type FindAllParams = {
  page: number;
  limit: number;
  search?: string;
  entityType?: string;
  dateFrom?: string;
  dateTo?: string;
};

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async log(entry: LogEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({ data: entry });
    } catch {
      // Never let audit log failure break the main operation
    }
  }

  async findAll(params: FindAllParams) {
    const skip = (params.page - 1) * params.limit;

    const where: Prisma.AuditLogWhereInput = {};

    if (params.search) {
      where.OR = [
        { adminEmail: { contains: params.search } },
        { entityId: { contains: params.search } },
      ];
    }

    if (params.entityType) {
      where.entityType = params.entityType;
    }

    if (params.dateFrom || params.dateTo) {
      where.createdAt = {};
      if (params.dateFrom) where.createdAt.gte = new Date(params.dateFrom);
      if (params.dateTo) {
        const to = new Date(params.dateTo);
        to.setHours(23, 59, 59, 999);
        where.createdAt.lte = to;
      }
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: params.limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      items,
      meta: {
        page: params.page,
        limit: params.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / params.limit)),
      },
    };
  }
}
