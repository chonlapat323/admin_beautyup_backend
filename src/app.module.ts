import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AdminUsersModule } from "./modules/admin-users/admin-users.module";
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
import { ShadesModule } from "./modules/shades/shades.module";
import { UploadsModule } from "./modules/uploads/uploads.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
    }),
    PrismaModule,
    AuthModule,
    AdminUsersModule,
    CategoriesModule,
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
    ShadesModule,
    SeederModule,
    UploadsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
