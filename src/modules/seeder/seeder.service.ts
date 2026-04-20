import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { createHash } from "crypto";
import { MENUS, buildFullPermissions } from "../roles/roles.service";
import { PrismaService } from "../prisma/prisma.service";

function hashPassword(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

@Injectable()
export class SeederService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeederService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap() {
    await this.seedRoles();
    await this.seedDefaultAdmin();
  }

  private async seedRoles() {
    const superAdminPerms = buildFullPermissions(
      MENUS.map((m) => ({ menu: m.menu, canView: true, canEdit: true, canDelete: true })),
    );

    const adminPerms = buildFullPermissions(
      MENUS.map((m) => ({
        menu: m.menu,
        canView: true,
        canEdit: !["admin-users", "roles", "settings"].includes(m.menu),
        canDelete: !["admin-users", "roles", "settings"].includes(m.menu),
      })),
    );

    await this.prisma.role.upsert({
      where: { name: "ซูเปอร์แอดมิน" },
      update: { permissions: superAdminPerms },
      create: { name: "ซูเปอร์แอดมิน", permissions: superAdminPerms, isActive: true },
    });

    await this.prisma.role.upsert({
      where: { name: "แอดมิน" },
      update: { permissions: adminPerms },
      create: { name: "แอดมิน", permissions: adminPerms, isActive: true },
    });
  }

  private async seedDefaultAdmin() {
    const count = await this.prisma.adminUser.count();
    if (count > 0) return;

    const superAdminRole = await this.prisma.role.findUnique({ where: { name: "ซูเปอร์แอดมิน" } });

    const data: Prisma.AdminUserUncheckedCreateInput = {
      email: "admin@beautyup.com",
      passwordHash: hashPassword("P@ssw0rd123"),
      roleId: superAdminRole?.id,
      firstName: "Admin",
      lastName: "Beautyup",
      isActive: true,
    };

    await this.prisma.adminUser.create({ data });

    this.logger.log("Default admin created: admin@beautyup.com");
  }
}
