import { Injectable } from "@nestjs/common";

@Injectable()
export class AdminUsersService {
  findAll() {
    return [
      { id: "admin_001", email: "owner@beautyup.com", role: "SUPER_ADMIN", isActive: true },
      { id: "admin_002", email: "staff@beautyup.com", role: "ADMIN", isActive: true },
    ];
  }

  create(payload: unknown) {
    return { message: "Admin user created.", payload };
  }

  findOne(id: string) {
    return { id, email: "admin@beautyup.com", role: "ADMIN", isActive: true };
  }

  update(id: string, payload: unknown) {
    return { message: "Admin user updated.", id, payload };
  }

  updateStatus(id: string, isActive: boolean) {
    return { message: "Admin user status updated.", id, isActive };
  }
}
