import { Injectable } from "@nestjs/common";

@Injectable()
export class CategoriesService {
  findAll() {
    return [
      { id: "cat_001", name: "Hair Color", slug: "hair-color", isActive: true },
      { id: "cat_002", name: "Leave In", slug: "leave-in", isActive: true },
    ];
  }

  create(payload: unknown) {
    return { message: "Category created.", payload };
  }

  findOne(id: string) {
    return { id, name: "Hair Color", slug: "hair-color", isActive: true };
  }

  update(id: string, payload: unknown) {
    return { message: "Category updated.", id, payload };
  }

  remove(id: string) {
    return { message: "Category removed.", id };
  }
}
