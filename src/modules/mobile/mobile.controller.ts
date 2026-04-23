import { Body, Controller, Get, Headers, Post, UnauthorizedException } from "@nestjs/common";
import { ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from "@nestjs/swagger";
import { IsArray, IsBoolean, IsInt, IsOptional, IsString, Min, MinLength, ValidateNested } from "class-validator";
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

class CheckoutDto {
  @ApiProperty({ type: [CheckoutItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CheckoutItemDto)
  items!: CheckoutItemDto[];

  @ApiProperty() @IsString() shippingName!: string;
  @ApiProperty() @IsString() shippingPhone!: string;
  @ApiProperty() @IsString() shippingAddr!: string;
}

@ApiTags("Mobile")
@Controller("mobile")
export class MobileController {
  constructor(private readonly mobileService: MobileService) {}

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

  private async extractMember(auth: string) {
    const token = auth?.replace(/^Bearer\s+/i, "");
    if (!token) throw new UnauthorizedException();
    return this.mobileService.validateToken(token);
  }
}
