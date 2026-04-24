import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
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
  private readonly logger = new Logger(MembersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly flowAccount: FlowAccountService,
  ) {}

  private syncDefaultAddressToFlowAccount(memberId: string, address: {
    addressLine1: string;
    addressLine2?: string | null;
    district?: string | null;
    province?: string | null;
    postalCode?: string | null;
  }): void {
    this.prisma.member.findUnique({ where: { id: memberId }, select: { flowAccountContactId: true, fullName: true, email: true, phone: true } })
      .then((m) => {
        if (!m?.flowAccountContactId) return;
        return this.flowAccount.updateContactAddress(m.flowAccountContactId, m.fullName, m.email, m.phone, address);
      })
      .catch((err) => this.logger.error(`[syncAddress] FAILED for member ${memberId}: ${String(err)}`));
  }

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
      memberType?: "REGULAR" | "SALON";
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

  // ─── Addresses ────────────────────────────────────────────────────────────────

  async listAddresses(memberId: string) {
    await this.findOne(memberId);
    return this.prisma.memberAddress.findMany({
      where: { memberId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    });
  }

  async createAddress(
    memberId: string,
    payload: {
      label?: string;
      recipient: string;
      phone: string;
      addressLine1: string;
      addressLine2?: string;
      district?: string;
      province?: string;
      postalCode?: string;
      isDefault?: boolean;
    },
  ) {
    await this.findOne(memberId);
    if (payload.isDefault) {
      await this.prisma.memberAddress.updateMany({ where: { memberId }, data: { isDefault: false } });
    }
    const isFirst = (await this.prisma.memberAddress.count({ where: { memberId } })) === 0;
    const isDefault = payload.isDefault ?? isFirst;
    const created = await this.prisma.memberAddress.create({
      data: { ...payload, memberId, isDefault },
    });
    if (isDefault) this.syncDefaultAddressToFlowAccount(memberId, created);
    return created;
  }

  async updateAddress(
    memberId: string,
    addressId: string,
    payload: {
      label?: string;
      recipient?: string;
      phone?: string;
      addressLine1?: string;
      addressLine2?: string;
      district?: string;
      province?: string;
      postalCode?: string;
      isDefault?: boolean;
    },
  ) {
    const addr = await this.prisma.memberAddress.findFirst({ where: { id: addressId, memberId } });
    if (!addr) throw new NotFoundException("ไม่พบที่อยู่");
    if (payload.isDefault) {
      await this.prisma.memberAddress.updateMany({ where: { memberId }, data: { isDefault: false } });
    }
    const updated = await this.prisma.memberAddress.update({ where: { id: addressId }, data: payload });
    if (updated.isDefault) this.syncDefaultAddressToFlowAccount(memberId, updated);
    return updated;
  }

  async deleteAddress(memberId: string, addressId: string) {
    const addr = await this.prisma.memberAddress.findFirst({ where: { id: addressId, memberId } });
    if (!addr) throw new NotFoundException("ไม่พบที่อยู่");
    await this.prisma.memberAddress.delete({ where: { id: addressId } });
    if (addr.isDefault) {
      const next = await this.prisma.memberAddress.findFirst({ where: { memberId }, orderBy: { createdAt: "asc" } });
      if (next) await this.prisma.memberAddress.update({ where: { id: next.id }, data: { isDefault: true } });
    }
    return { success: true };
  }

  async setDefaultAddress(memberId: string, addressId: string) {
    const addr = await this.prisma.memberAddress.findFirst({ where: { id: addressId, memberId } });
    if (!addr) throw new NotFoundException("ไม่พบที่อยู่");
    await this.prisma.memberAddress.updateMany({ where: { memberId }, data: { isDefault: false } });
    const updated = await this.prisma.memberAddress.update({ where: { id: addressId }, data: { isDefault: true } });
    this.syncDefaultAddressToFlowAccount(memberId, updated);
    return updated;
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
