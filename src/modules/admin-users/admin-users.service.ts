import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { createHash } from "crypto";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

const SAFE_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  roleId: true,
  role: { select: { id: true, name: true } },
  isActive: true,
  storeId: true,
  createdAt: true,
  updatedAt: true,
} as const;

function hashPassword(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(params: { search?: string; status?: string; page: number; pageSize: number }) {
    const where: Prisma.AdminUserWhereInput = {};

    if (params.search) {
      where.OR = [
        { email: { contains: params.search, mode: "insensitive" } },
        { firstName: { contains: params.search, mode: "insensitive" } },
        { lastName: { contains: params.search, mode: "insensitive" } },
      ];
    }

    if (params.status === "active") where.isActive = true;
    if (params.status === "inactive") where.isActive = false;

    const [items, totalItems] = await this.prisma.$transaction([
      this.prisma.adminUser.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
        select: SAFE_SELECT,
      }),
      this.prisma.adminUser.count({ where }),
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
    email: string;
    password: string;
    roleId?: string;
    firstName?: string;
    lastName?: string;
    storeId?: string;
  }) {
    try {
      const data: Prisma.AdminUserUncheckedCreateInput = {
        email: payload.email,
        passwordHash: hashPassword(payload.password),
        roleId: payload.roleId,
        firstName: payload.firstName,
        lastName: payload.lastName,
        storeId: payload.storeId,
      };
      return await this.prisma.adminUser.create({ data, select: SAFE_SELECT });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new BadRequestException("อีเมลนี้ถูกใช้งานแล้ว");
      }
      throw error;
    }
  }

  async findOne(id: string) {
    const user = await this.prisma.adminUser.findUnique({ where: { id }, select: SAFE_SELECT });
    if (!user) throw new NotFoundException("ไม่พบผู้ดูแลระบบ");
    return user;
  }

  async update(
    id: string,
    payload: {
      email?: string;
      password?: string;
      roleId?: string;
      firstName?: string;
      lastName?: string;
      storeId?: string;
    },
  ) {
    await this.findOne(id);
    const data: Prisma.AdminUserUncheckedUpdateInput = {};
    if (payload.email !== undefined) data.email = payload.email;
    if (payload.roleId !== undefined) data.roleId = payload.roleId;
    if (payload.firstName !== undefined) data.firstName = payload.firstName;
    if (payload.lastName !== undefined) data.lastName = payload.lastName;
    if (payload.storeId !== undefined) data.storeId = payload.storeId;
    if (payload.password) data.passwordHash = hashPassword(payload.password);

    try {
      return await this.prisma.adminUser.update({ where: { id }, data, select: SAFE_SELECT });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new BadRequestException("อีเมลนี้ถูกใช้งานแล้ว");
      }
      throw error;
    }
  }

  async updateStatus(id: string, isActive: boolean) {
    await this.findOne(id);
    return this.prisma.adminUser.update({ where: { id }, data: { isActive }, select: SAFE_SELECT });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.adminUser.delete({ where: { id } });
  }
}
