import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

type FindAllParams = {
  page: number;
  limit: number;
  memberId?: string;
  type?: string;
  dateFrom?: string;
  dateTo?: string;
};

@Injectable()
export class CreditTransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(params: FindAllParams) {
    const skip = (params.page - 1) * params.limit;

    const where: Prisma.CreditTransactionWhereInput = {};

    if (params.memberId) {
      where.memberId = params.memberId;
    }

    if (params.type) {
      where.type = params.type as Prisma.EnumCreditTransactionTypeFilter;
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
      this.prisma.creditTransaction.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: params.limit,
        include: {
          member: { select: { id: true, fullName: true, email: true } },
        },
      }),
      this.prisma.creditTransaction.count({ where }),
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
