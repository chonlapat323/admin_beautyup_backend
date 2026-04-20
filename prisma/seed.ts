import { createHash } from "crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function hashPassword(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

const MENUS = [
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

async function main() {
  const superAdminRole = await prisma.role.upsert({
    where: { name: "ซูเปอร์แอดมิน" },
    update: {},
    create: {
      name: "ซูเปอร์แอดมิน",
      permissions: MENUS.map((m) => ({ ...m, canView: true, canEdit: true, canDelete: true })),
      isActive: true,
    },
  });

  await prisma.role.upsert({
    where: { name: "แอดมิน" },
    update: {},
    create: {
      name: "แอดมิน",
      permissions: MENUS.map((m) => ({
        ...m,
        canView: true,
        canEdit: !["admin-users", "roles", "settings"].includes(m.menu),
        canDelete: !["admin-users", "roles", "settings"].includes(m.menu),
      })),
      isActive: true,
    },
  });

  await prisma.adminUser.upsert({
    where: { email: "admin@beautyup.com" },
    update: {},
    create: {
      email: "admin@beautyup.com",
      passwordHash: hashPassword("P@ssw0rd123"),
      roleId: superAdminRole.id,
      firstName: "Admin",
      lastName: "Beautyup",
      isActive: true,
    },
  });

  console.log("Seed completed: roles + admin@beautyup.com");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
