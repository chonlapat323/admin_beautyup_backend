import { BadRequestException, Body, Controller, Delete, Get, Headers, Param, Patch, Post, UnauthorizedException } from "@nestjs/common";
import { RewardProductsService } from "../reward-products/reward-products.service";
import { ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from "@nestjs/swagger";
import { IsArray, IsBoolean, IsInt, IsNumber, IsOptional, IsString, Min, MinLength, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { MobileService } from "./mobile.service";


class RegisterDto {
  @ApiProperty() @IsString() fullName!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiProperty() @IsString() @MinLength(6) password!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() referralCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() salonCode?: string;
}

class LoginDto {
  @ApiProperty() @IsString() identifier!: string;
  @ApiProperty() @IsString() password!: string;
}

class AddressDto {
  @ApiPropertyOptional() @IsOptional() @IsString() label?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() storeName?: string;
  @ApiProperty() @IsString() recipient!: string;
  @ApiProperty() @IsString() phone!: string;
  @ApiProperty() @IsString() addressLine1!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() addressLine2?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() district?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() province?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() postalCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isDefault?: boolean;
}

class UpdateAddressDto {
  @ApiPropertyOptional() @IsOptional() @IsString() label?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() storeName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() recipient?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() addressLine1?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() addressLine2?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() district?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() province?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() postalCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isDefault?: boolean;
}

class CheckoutItemDto {
  @ApiProperty() @IsString() productId!: string;
  @ApiProperty() @IsInt() @Min(1) @Type(() => Number) quantity!: number;
}

class PromptPayDto {
  @ApiProperty({ type: [CheckoutItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CheckoutItemDto)
  items!: CheckoutItemDto[];

  @ApiProperty() @IsString() shippingName!: string;
  @ApiProperty() @IsString() shippingPhone!: string;
  @ApiProperty() @IsString() shippingAddr!: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Type(() => Number) creditAmount?: number;
}

class WithdrawalDto {
  @ApiProperty({ description: "จำนวน credit ที่ต้องการถอน" })
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  amount!: number;
}

class CheckoutDto {
  @ApiProperty({ type: [CheckoutItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CheckoutItemDto)
  items!: CheckoutItemDto[];

  @ApiProperty() @IsString() shippingName!: string;
  @ApiProperty() @IsString() shippingPhone!: string;
  @ApiProperty() @IsString() shippingAddr!: string;
  @ApiPropertyOptional({ description: "Omise card token (ไม่จำเป็นถ้าใช้ credit ครอบคลุมทั้งหมด)" })
  @IsOptional() @IsString() omiseToken?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Type(() => Number) creditAmount?: number;
}

@ApiTags("Mobile")
@Controller("mobile")
export class MobileController {
  constructor(
    private readonly mobileService: MobileService,
    private readonly rewardProductsService: RewardProductsService,
  ) {}

  @Get("config")
  @ApiOperation({ summary: "Public app config (gateway fee etc.)" })
  getConfig() {
    return this.mobileService.getConfig();
  }

  @Post("register")
  @ApiOperation({ summary: "Member register" })
  register(@Body() dto: RegisterDto) {
    return this.mobileService.register(dto);
  }

  @Post("login")
  @ApiOperation({ summary: "Member login" })
  login(@Body() dto: LoginDto) {
    return this.mobileService.login(dto);
  }

  @Get("profile")
  @ApiOperation({ summary: "Get current member profile" })
  async getProfile(@Headers("authorization") auth: string) {
    const member = await this.extractMember(auth);
    return this.mobileService.getProfile(member.id);
  }

  @Post("checkout")
  @ApiOperation({ summary: "Place order (sets status to PAID)" })
  async checkout(@Headers("authorization") auth: string, @Body() dto: CheckoutDto) {
    const member = await this.extractMember(auth);
    return this.mobileService.checkout(member.id, dto);
  }

  @Get("orders")
  @ApiOperation({ summary: "Get order history for current member" })
  async getOrders(@Headers("authorization") auth: string) {
    const member = await this.extractMember(auth);
    return this.mobileService.getOrders(member.id);
  }

  @Get("orders/:orderId/documents")
  @ApiOperation({ summary: "Get FlowAccount shareable links for tax invoice and receipt" })
  async getOrderDocuments(@Headers("authorization") auth: string, @Param("orderId") orderId: string) {
    const member = await this.extractMember(auth);
    return this.mobileService.getDocumentUrls(orderId, member.id);
  }

  @Post("promptpay")
  @ApiOperation({ summary: "Initiate PromptPay QR payment" })
  async initiatePromptPay(@Headers("authorization") auth: string, @Body() dto: PromptPayDto) {
    const member = await this.extractMember(auth);
    return this.mobileService.initiatePromptPay(member.id, dto);
  }

  @Get("promptpay/:chargeId")
  @ApiOperation({ summary: "Check PromptPay charge status" })
  async checkPromptPay(@Headers("authorization") auth: string, @Param("chargeId") chargeId: string) {
    const member = await this.extractMember(auth);
    return this.mobileService.checkPromptPay(chargeId, member.id);
  }

  @Get("addresses")
  @ApiOperation({ summary: "List my addresses" })
  async getAddresses(@Headers("authorization") auth: string) {
    const member = await this.extractMember(auth);
    return this.mobileService.listAddresses(member.id);
  }

  @Post("addresses")
  @ApiOperation({ summary: "Add address" })
  async addAddress(@Headers("authorization") auth: string, @Body() dto: AddressDto) {
    const member = await this.extractMember(auth);
    return this.mobileService.createAddress(member.id, dto);
  }

  @Patch("addresses/:id")
  @ApiOperation({ summary: "Update address" })
  async updateAddress(
    @Headers("authorization") auth: string,
    @Param("id") id: string,
    @Body() dto: UpdateAddressDto,
  ) {
    const member = await this.extractMember(auth);
    return this.mobileService.updateAddress(member.id, id, dto);
  }

  @Get("me/commissions")
  @ApiOperation({ summary: "Get commission summary for current member" })
  async getCommissionSummary(@Headers("authorization") auth: string) {
    const member = await this.extractMember(auth);
    return this.mobileService.getCommissionSummary(member.id);
  }

  @Get("me/credit-transactions")
  @ApiOperation({ summary: "Get credit transaction history" })
  async getCreditTransactions(@Headers("authorization") auth: string) {
    const member = await this.extractMember(auth);
    return this.mobileService.getCreditTransactions(member.id);
  }

  @Post("me/withdraw")
  @ApiOperation({ summary: "Request credit withdrawal" })
  async requestWithdrawal(@Headers("authorization") auth: string, @Body() dto: WithdrawalDto) {
    const member = await this.extractMember(auth);
    return this.mobileService.requestWithdrawal(member.id, dto.amount);
  }

  @Get("me/withdrawals")
  @ApiOperation({ summary: "Get withdrawal request history" })
  async getWithdrawals(@Headers("authorization") auth: string) {
    const member = await this.extractMember(auth);
    return this.mobileService.getWithdrawals(member.id);
  }

  @Delete("addresses/:id")
  @ApiOperation({ summary: "Delete address" })
  async deleteAddress(@Headers("authorization") auth: string, @Param("id") id: string) {
    const member = await this.extractMember(auth);
    return this.mobileService.deleteAddress(member.id, id);
  }

  @Patch("addresses/:id/default")
  @ApiOperation({ summary: "Set address as default" })
  async setDefaultAddress(@Headers("authorization") auth: string, @Param("id") id: string) {
    const member = await this.extractMember(auth);
    return this.mobileService.setDefaultAddress(member.id, id);
  }

  @Get("rewards")
  @ApiOperation({ summary: "List active reward products" })
  getRewards() {
    return this.rewardProductsService.listActive();
  }

  @Post("rewards/:id/redeem")
  @ApiOperation({ summary: "Redeem a reward product" })
  async redeemReward(@Headers("authorization") auth: string, @Param("id") id: string) {
    const member = await this.extractMember(auth);
    return this.rewardProductsService.redeem(member.id, id);
  }

  private async extractMember(auth: string) {
    const token = auth?.replace(/^Bearer\s+/i, "");
    if (!token) throw new UnauthorizedException();
    return this.mobileService.validateToken(token);
  }
}
