import { Injectable } from "@nestjs/common";

@Injectable()
export class ReportsService {
  dashboard() {
    return {
      totalSales: 12000,
      totalOrders: 45,
      totalMembers: 128,
      lowStockProducts: 3,
    };
  }

  salesByStore() {
    return [
      { storeId: "store_main", storeName: "Main Store", totalSales: 9000 },
      { storeId: "store_bkk", storeName: "Bangkok Branch", totalSales: 3000 },
    ];
  }

  inventory() {
    return [
      { sku: "SKU-001", productName: "Koleston Perfect", stock: 200, sellableStock: 180 },
    ];
  }
}
