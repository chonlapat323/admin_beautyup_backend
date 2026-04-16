import { Injectable } from "@nestjs/common";

@Injectable()
export class MembersService {
  findAll() {
    return [
      { id: "mem_001", fullName: "Pao Chonlapat", phone: "0812345678", pointBalance: 300 },
      { id: "mem_002", fullName: "Demo Member", phone: "0899999999", pointBalance: 0 },
    ];
  }

  create(payload: unknown) {
    return { message: "Member created.", payload };
  }

  findOne(id: string) {
    return { id, fullName: "Pao Chonlapat", email: "member@beautyup.com", pointBalance: 300 };
  }

  update(id: string, payload: unknown) {
    return { message: "Member updated.", id, payload };
  }

  remove(id: string) {
    return { message: "Member removed.", id };
  }
}
