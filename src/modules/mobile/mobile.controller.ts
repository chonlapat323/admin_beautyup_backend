import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, Headers, Param, Patch, Post, UnauthorizedException, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { existsSync, mkdirSync } from "fs";
import { extname, join } from "path";
import { diskStorage } from "multer";
import { RewardProductsService } from "../reward-products/reward-products.service";
import { ApiConsumes, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from "@nestjs/swagger";
import { IsArray, IsBoolean, IsInt, IsNumber, IsOptional, IsString, Min, MinLength, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { MobileService } from "./mobile.service";

const membersDir = join(process.cwd(), "uploads", "members");

const profileImageMulterOptions = {
  storage: diskStorage({
    destination: (_req: unknown, _file: unknown, cb: (err: Error | null, dest: string) => void) => {
      if (!existsSync(membersDir)) mkdirSync(membersDir, { recursive: true });
      cb(null, membersDir);
    },
    filename: (_req: unknown, file: Express.Multer.File, cb: (err: Error | null, name: string) => void) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${unique}${extname(file.originalname)}`);
    },
  }),
  fileFilter: (_req: unknown, file: Express.Multer.File, cb: (err: Error | null, ok: boolean) => void) => {
    if (/image\/(jpeg|png|webp|gif)/.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"), false);
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 },
};


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

class KBankPayDto {
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

class TrueMoneyDto {
  @ApiProperty({ type: [CheckoutItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CheckoutItemDto)
  items!: CheckoutItemDto[];

  @ApiProperty() @IsString() shippingName!: string;
  @ApiProperty() @IsString() shippingPhone!: string;
  @ApiProperty() @IsString() shippingAddr!: string;
  @ApiProperty() @IsString() phoneNumber!: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Type(() => Number) creditAmount?: number;
}

class BankAccountDto {
  @ApiProperty() @IsString() bankName!: string;
  @ApiProperty() @IsString() bankAccountNumber!: string;
  @ApiProperty() @IsString() bankAccountName!: string;
}

class RedeemRewardDto {
  @ApiProperty({ description: "ID ของที่อยู่สำหรับจัดส่ง" }) @IsString() addressId!: string;
}

class UpdatePushTokenDto {
  @ApiProperty() @IsString() expoPushToken!: string;
}

class WithdrawalDto {
  @ApiProperty({ description: "จำนวน credit ที่ต้องการถอน" })
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  amount!: number;

  @ApiProperty({ description: "ชื่อธนาคาร" })
  @IsString()
  bankName!: string;

  @ApiProperty({ description: "เลขที่บัญชี" })
  @IsString()
  bankAccountNumber!: string;

  @ApiProperty({ description: "ชื่อบัญชี" })
  @IsString()
  bankAccountName!: string;
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

  @Post("kbank-pay")
  @ApiOperation({ summary: "Initiate KBank K+ AppSwitch payment" })
  async initiateKBankPay(@Headers("authorization") auth: string, @Body() dto: KBankPayDto) {
    const member = await this.extractMember(auth);
    return this.mobileService.initiateKBankPayment(member.id, dto);
  }

  @Get("kbank-pay/:partnerPaymentID")
  @ApiOperation({ summary: "Check KBank payment status (K+ and Card)" })
  async checkKBankPay(@Headers("authorization") auth: string, @Param("partnerPaymentID") partnerPaymentID: string) {
    const member = await this.extractMember(auth);
    return this.mobileService.checkKBankPayment(partnerPaymentID, member.id);
  }

  @Post("kbank-card")
  @ApiOperation({ summary: "Initiate KBank Credit/Debit card payment" })
  async initiateKBankCardPay(@Headers("authorization") auth: string, @Body() dto: KBankPayDto) {
    const member = await this.extractMember(auth);
    return this.mobileService.initiateKBankCardPayment(member.id, dto);
  }

  @Post("kbank-qr")
  @ApiOperation({ summary: "Initiate KBank BOT QR payment" })
  async initiateKBankQRPay(@Headers("authorization") auth: string, @Body() dto: KBankPayDto) {
    const member = await this.extractMember(auth);
    return this.mobileService.initiateKBankQRPayment(member.id, dto);
  }

  @Post("truemoney")
  @ApiOperation({ summary: "Initiate TrueMoney Wallet payment" })
  async initiateTrueMoney(@Headers("authorization") auth: string, @Body() dto: TrueMoneyDto) {
    const member = await this.extractMember(auth);
    return this.mobileService.initiateTrueMoney(member.id, dto);
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
    return this.mobileService.requestWithdrawal(
      member.id,
      dto.amount,
      dto.bankName,
      dto.bankAccountNumber,
      dto.bankAccountName,
    );
  }

  @Get("me/withdrawals")
  @ApiOperation({ summary: "Get withdrawal request history" })
  async getWithdrawals(@Headers("authorization") auth: string) {
    const member = await this.extractMember(auth);
    return this.mobileService.getWithdrawals(member.id);
  }

  @Patch("me/bank-account")
  @ApiOperation({ summary: "Save member bank account" })
  async updateBankAccount(@Headers("authorization") auth: string, @Body() dto: BankAccountDto) {
    const member = await this.extractMember(auth);
    return this.mobileService.updateBankAccount(member.id, dto.bankName, dto.bankAccountNumber, dto.bankAccountName);
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
  @ApiOperation({ summary: "Redeem a reward product with shipping address" })
  async redeemReward(
    @Headers("authorization") auth: string,
    @Param("id") id: string,
    @Body() dto: RedeemRewardDto,
  ) {
    const member = await this.extractMember(auth);
    const address = await this.mobileService.getAddressForMember(member.id, dto.addressId);
    if (!address) throw new BadRequestException("ไม่พบที่อยู่จัดส่ง");

    const parts = [
      address.addressLine1,
      address.addressLine2,
      address.district,
      address.province,
      address.postalCode,
    ].filter(Boolean);
    const fullAddressString = parts.join(" ");

    const shipping = {
      recipient: address.recipient,
      phone: address.phone,
      address: fullAddressString,
    };
    return this.rewardProductsService.redeem(member.id, id, shipping);
  }

  @Get("me/redemptions")
  @ApiOperation({ summary: "Get redemption history for current member" })
  async getRedemptions(@Headers("authorization") auth: string) {
    const member = await this.extractMember(auth);
    return this.mobileService.getRedemptions(member.id);
  }

  @Get("me/redemptions/:id")
  @ApiOperation({ summary: "Get one redemption detail for current member" })
  async getRedemptionDetail(@Headers("authorization") auth: string, @Param("id") id: string) {
    const member = await this.extractMember(auth);
    const redemption = await this.rewardProductsService.getRedemptionById(id);
    if (redemption.memberId !== member.id) throw new ForbiddenException();
    return redemption;
  }

  @Patch("me/push-token")
  @ApiOperation({ summary: "Update Expo push token for current member" })
  async updatePushToken(@Headers("authorization") auth: string, @Body() dto: UpdatePushTokenDto) {
    const member = await this.extractMember(auth);
    return this.mobileService.updatePushToken(member.id, dto.expoPushToken);
  }

  @Post("me/profile-image")
  @ApiOperation({ summary: "Upload profile image for current member" })
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("image", profileImageMulterOptions))
  async uploadProfileImage(
    @Headers("authorization") auth: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException("กรุณาแนบไฟล์รูปภาพ");
    const member = await this.extractMember(auth);
    return this.mobileService.updateProfileImage(member.id, file);
  }

  private async extractMember(auth: string) {
    const token = auth?.replace(/^Bearer\s+/i, "");
    if (!token) throw new UnauthorizedException();
    return this.mobileService.validateToken(token);
  }
}
