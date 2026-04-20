import { Injectable, UnauthorizedException } from "@nestjs/common";
import { createHash } from "crypto";
import { PrismaService } from "../prisma/prisma.service";

function hashPassword(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async login(payload: { email: string; password: string }) {
    const user = await this.prisma.adminUser.findUnique({
      where: { email: payload.email },
      include: { role: { select: { id: true, name: true } } },
    });

    if (!user || !user.isActive || hashPassword(payload.password) !== user.passwordHash) {
      throw new UnauthorizedException("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
    }

    return {
      message: "Login successful.",
      accessToken: `token-${user.id}`,
      admin: {
        id: user.id,
        email: user.email,
        role: user.role?.name ?? "ไม่ระบุ",
        roleId: user.roleId,
      },
    };
  }

  forgotPassword(payload: { email: string }) {
    return {
      message: `Password reset flow placeholder created for ${payload.email}.`,
    };
  }

  resetPassword() {
    return {
      message: "Reset password endpoint is ready for implementation.",
    };
  }

  profile() {
    return {
      id: "admin_001",
      email: "owner@beautyup.local",
      role: "ซูเปอร์แอดมิน",
      storeId: "store_main",
    };
  }
}
