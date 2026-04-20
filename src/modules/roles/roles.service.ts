import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

export type MenuPermission = {
  menu: string;
  label: string;
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
};

export const MENUS: { menu: string; label: string }[] = [
  { menu: "dashboard", label: "ภาพรวม" },
  { menu: "categories", label: "หมวดหมู่" },
  { menu: "products", label: "สินค้า" },
  { menu: "members", label: "สมาชิก" },
  { menu: "admin-users", label: "ผู้ดูแลระบบ" },
  { menu: "roles", label: "สิทธิ์การใช้งาน" },
  { menu: "orders", label: "คำสั่งซื้อ" },
  { menu: "payments", label: "การชำระเงิน" },
  { menu: "reports", label: "รายงาน" },
  { menu: "settings", label: "ตั้งค่า" },
];

export function buildFullPermissions(partial: Partial<MenuPermission>[] = []): MenuPermission[] {
  return MENUS.map((menu) => {
    const found = partial.find((p) => p.menu === menu.menu);
    return {
      menu: menu.menu,
      label: menu.label,
      canView: found?.canView ?? false,
      canEdit: found?.canEdit ?? false,
      canDelete: found?.canDelete ?? false,
    };
  });
}

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(params: { search?: string; status?: string; page: number; pageSize: number }) {
    const where: Prisma.RoleWhereInput = {};
    if (params.search) {
      where.name = { contains: params.search, mode: "insensitive" };
    }
    if (params.status === "active") where.isActive = true;
    if (params.status === "inactive") where.isActive = false;

    const [items, totalItems] = await this.prisma.$transaction([
      this.prisma.role.findMany({
        where,
        orderBy: { createdAt: "asc" },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
        include: { _count: { select: { admins: true } } },
      }),
      this.prisma.role.count({ where }),
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

  async create(payload: { name: string; permissions: Partial<MenuPermission>[] }) {
    try {
      return await this.prisma.role.create({
        data: {
          name: payload.name,
          permissions: buildFullPermissions(payload.permissions),
        },
        include: { _count: { select: { admins: true } } },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new BadRequestException("ชื่อสิทธิ์นี้ถูกใช้งานแล้ว");
      }
      throw error;
    }
  }

  async findOne(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: { _count: { select: { admins: true } } },
    });
    if (!role) throw new NotFoundException("ไม่พบสิทธิ์การใช้งาน");
    return role;
  }

  async update(id: string, payload: { name?: string; permissions?: Partial<MenuPermission>[] }) {
    await this.findOne(id);
    const data: Prisma.RoleUpdateInput = {};
    if (payload.name !== undefined) data.name = payload.name;
    if (payload.permissions !== undefined) data.permissions = buildFullPermissions(payload.permissions);
    try {
      return await this.prisma.role.update({
        where: { id },
        data,
        include: { _count: { select: { admins: true } } },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new BadRequestException("ชื่อสิทธิ์นี้ถูกใช้งานแล้ว");
      }
      throw error;
    }
  }

  async updateStatus(id: string, isActive: boolean) {
    await this.findOne(id);
    return this.prisma.role.update({
      where: { id },
      data: { isActive },
      include: { _count: { select: { admins: true } } },
    });
  }

  async remove(id: string) {
    const role = await this.findOne(id);
    if (role._count.admins > 0) {
      throw new BadRequestException("ไม่สามารถลบสิทธิ์ที่มีผู้ดูแลระบบอยู่");
    }
    return this.prisma.role.delete({ where: { id } });
  }

  getMenus() {
    return MENUS;
  }
}
