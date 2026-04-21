import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { FlowAccountService } from "../flowaccount/flowaccount.service";
import { PrismaService } from "../prisma/prisma.service";

type MemberListParams = {
  search?: string;
  status?: "all" | "active" | "inactive";
  page: number;
  pageSize: number;
};

@Injectable()
export class MembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly flowAccount: FlowAccountService,
  ) {}

  async findAll(params: MemberListParams) {
    const where: Prisma.MemberWhereInput = {};

    if (params.search) {
      where.OR = [
        { fullName: { contains: params.search, mode: "insensitive" } },
        { phone: { contains: params.search, mode: "insensitive" } },
        { email: { contains: params.search, mode: "insensitive" } },
      ];
    }

    if (params.status === "active") where.isActive = true;
    if (params.status === "inactive") where.isActive = false;

    const [items, totalItems] = await this.prisma.$transaction([
      this.prisma.member.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
        include: {
          _count: { select: { orders: true, referrals: true } },
        },
      }),
      this.prisma.member.count({ where }),
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
    fullName: string;
    phone?: string;
    email?: string;
    referredById?: string;
  }) {
    let member;
    try {
      member = await this.prisma.member.create({
        data: payload,
        include: { _count: { select: { orders: true, referrals: true } } },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new BadRequestException("อีเมลหรือเบอร์โทรนี้ถูกใช้งานแล้ว");
      }
      throw error;
    }

    const contactId = await this.flowAccount.createContact({
      fullName: member.fullName,
      email: member.email,
      phone: member.phone,
    });

    if (contactId) {
      member = await this.prisma.member.update({
        where: { id: member.id },
        data: { flowAccountContactId: contactId },
        include: { _count: { select: { orders: true, referrals: true } } },
      });
    }

    return member;
  }

  async findOne(id: string) {
    const member = await this.prisma.member.findUnique({
      where: { id },
      include: { _count: { select: { orders: true, referrals: true } } },
    });
    if (!member) throw new NotFoundException("ไม่พบสมาชิก");
    return member;
  }

  async update(
    id: string,
    payload: {
      fullName?: string;
      phone?: string;
      email?: string;
      referredById?: string;
    },
  ) {
    await this.findOne(id);
    try {
      return await this.prisma.member.update({
        where: { id },
        data: payload,
        include: { _count: { select: { orders: true, referrals: true } } },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new BadRequestException("อีเมลหรือเบอร์โทรนี้ถูกใช้งานแล้ว");
      }
      throw error;
    }
  }

  async updateStatus(id: string, isActive: boolean) {
    await this.findOne(id);
    return this.prisma.member.update({
      where: { id },
      data: { isActive },
      include: { _count: { select: { orders: true, referrals: true } } },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    try {
      return await this.prisma.member.delete({ where: { id } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
        throw new BadRequestException("ไม่สามารถลบสมาชิกที่มีคำสั่งซื้อได้");
      }
      throw error;
    }
  }
}
