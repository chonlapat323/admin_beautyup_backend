import { Injectable } from "@nestjs/common";

@Injectable()
export class AuthService {
  login(payload: { email: string; password: string }) {
    return {
      message: "Login endpoint is ready for implementation.",
      accessToken: "mock-access-token",
      admin: {
        id: "admin_001",
        email: payload.email,
        role: "SUPER_ADMIN",
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
      role: "SUPER_ADMIN",
      storeId: "store_main",
    };
  }
}
