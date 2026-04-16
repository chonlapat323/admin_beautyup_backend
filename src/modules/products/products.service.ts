import { Injectable } from "@nestjs/common";

@Injectable()
export class ProductsService {
  findAll() {
    return [
      { id: "prod_001", sku: "SKU-001", name: "Koleston Perfect", status: "ACTIVE", stock: 180 },
      { id: "prod_002", sku: "SKU-002", name: "Illumina Color", status: "ACTIVE", stock: 95 },
    ];
  }

  create(payload: unknown) {
    return { message: "Product created.", payload };
  }

  findOne(id: string) {
    return { id, sku: "SKU-001", name: "Koleston Perfect", status: "ACTIVE", stock: 180 };
  }

  update(id: string, payload: unknown) {
    return { message: "Product updated.", id, payload };
  }

  updateStatus(id: string, status: string) {
    return { message: "Product status updated.", id, status };
  }
}
