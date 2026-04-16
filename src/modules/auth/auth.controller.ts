import { Body, Controller, Get, Post } from "@nestjs/common";
import { ApiOperation, ApiProperty, ApiTags } from "@nestjs/swagger";
import { IsEmail, IsString, MinLength } from "class-validator";

import { AuthService } from "./auth.service";

class LoginDto {
  @ApiProperty({ example: "admin@beautyup.com" })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: "P@ssw0rd123" })
  @IsString()
  @MinLength(6)
  password!: string;
}

class ForgotPasswordDto {
  @ApiProperty({ example: "admin@beautyup.com" })
  @IsEmail()
  email!: string;
}

class ResetPasswordDto {
  @ApiProperty({ example: "reset-token" })
  @IsString()
  token!: string;

  @ApiProperty({ example: "N3wP@ssw0rd123" })
  @IsString()
  @MinLength(6)
  newPassword!: string;
}

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("login")
  @ApiOperation({ summary: "Admin login" })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post("forgot-password")
  @ApiOperation({ summary: "Request password reset" })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post("reset-password")
  @ApiOperation({ summary: "Reset password" })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword();
  }

  @Get("profile")
  @ApiOperation({ summary: "Get current admin profile" })
  profile() {
    return this.authService.profile();
  }
}
