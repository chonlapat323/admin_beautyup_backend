import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AuditLogModule } from "./modules/audit-log/audit-log.module";
import { BrandsModule } from "./modules/brands/brands.module";
import { CollectionsModule } from "./modules/collections/collections.module";
import { AdminUsersModule } from "./modules/admin-users/admin-users.module";
import { BannersModule } from "./modules/banners/banners.module";
import { BundlesModule } from "./modules/bundles/bundles.module";
import { CarriersModule } from "./modules/carriers/carriers.module";
import { AuthModule } from "./modules/auth/auth.module";
import { CategoriesModule } from "./modules/categories/categories.module";
import { MembersModule } from "./modules/members/members.module";
import { OrdersModule } from "./modules/orders/orders.module";
import { PaymentsModule } from "./modules/payments/payments.module";
import { PointsModule } from "./modules/points/points.module";
import { PrismaModule } from "./modules/prisma/prisma.module";
import { ProductsModule } from "./modules/products/products.module";
import { ReferralsModule } from "./modules/referrals/referrals.module";
import { ReportsModule } from "./modules/reports/reports.module";
import { RolesModule } from "./modules/roles/roles.module";
import { SeederModule } from "./modules/seeder/seeder.module";
import { SettingsModule } from "./modules/settings/settings.module";
import { StockModule } from "./modules/stock/stock.module";
import { ShadeGroupsModule } from "./modules/shade-groups/shade-groups.module";
import { ShadesModule } from "./modules/shades/shades.module";
import { UploadsModule } from "./modules/uploads/uploads.module";
import { KBankModule } from "./modules/kbank/kbank.module";
import { MobileModule } from "./modules/mobile/mobile.module";
import { CommissionModule } from "./modules/commission/commission.module";
import { SalonCodesModule } from "./modules/salon-codes/salon-codes.module";
import { RewardProductsModule } from "./modules/reward-products/reward-products.module";
import { CreditTransactionsModule } from "./modules/credit-transactions/credit-transactions.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
    }),
    PrismaModule,
    AuditLogModule,
    KBankModule,
    MobileModule,
    CommissionModule,
    AuthModule,
    AdminUsersModule,
    BrandsModule,
    CategoriesModule,
    CollectionsModule,
    ProductsModule,
    MembersModule,
    OrdersModule,
    PaymentsModule,
    StockModule,
    PointsModule,
    ReferralsModule,
    SettingsModule,
    ReportsModule,
    RolesModule,
    ShadeGroupsModule,
    ShadesModule,
    BannersModule,
    BundlesModule,
    CarriersModule,
    SeederModule,
    UploadsModule,
    SalonCodesModule,
    RewardProductsModule,
    CreditTransactionsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
