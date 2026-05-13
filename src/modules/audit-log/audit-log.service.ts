import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

type LogEntry = {
  adminEmail: string;
  action: string;
  entityType: string;
  entityId: string;
  detail?: string;
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

  async findAll(params: { page: number; limit: number }) {
    const skip = (params.page - 1) * params.limit;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        skip,
        take: params.limit,
      }),
      this.prisma.auditLog.count(),
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
