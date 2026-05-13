import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { CreditTransactionsController } from "./credit-transactions.controller";
import { CreditTransactionsService } from "./credit-transactions.service";

@Module({
  imports: [PrismaModule],
  controllers: [CreditTransactionsController],
  providers: [CreditTransactionsService],
})
export class CreditTransactionsModule {}
