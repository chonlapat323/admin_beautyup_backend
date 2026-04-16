import { Injectable } from "@nestjs/common";

@Injectable()
export class StockService {
  summary() {
    return [
      { productId: "prod_001", sku: "SKU-001", stock: 200, reserveStock: 20, sellableStock: 180 },
      { productId: "prod_002", sku: "SKU-002", stock: 100, reserveStock: 5, sellableStock: 95 },
    ];
  }

  adjust(payload: unknown) {
    return { message: "Stock adjusted.", payload };
  }
}
