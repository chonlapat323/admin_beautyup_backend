import { Controller, Get, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString } from "class-validator";
import { CreditTransactionsService } from "./credit-transactions.service";

class CreditTransactionQueryDto {
  @IsOptional() @IsInt() @Type(() => Number) page?: number;
  @IsOptional() @IsInt() @Type(() => Number) limit?: number;
  @IsOptional() @IsString() memberId?: string;
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsString() dateFrom?: string;
  @IsOptional() @IsString() dateTo?: string;
}

@ApiTags("Credit Transactions")
@Controller("credit-transactions")
export class CreditTransactionsController {
  constructor(private readonly service: CreditTransactionsService) {}

  @Get()
  @ApiOperation({ summary: "List credit transactions with filters" })
  findAll(@Query() query: CreditTransactionQueryDto) {
    return this.service.findAll({
      page: query.page && query.page > 0 ? query.page : 1,
      limit: query.limit && query.limit > 0 ? query.limit : 50,
      memberId: query.memberId || undefined,
      type: query.type || undefined,
      dateFrom: query.dateFrom || undefined,
      dateTo: query.dateTo || undefined,
    });
  }
}
