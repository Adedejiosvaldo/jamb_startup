import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import { TokenService } from './token.service';

@Module({
  controllers: [AuthController],
  providers: [OtpService, TokenService, AuthService, AuthGuard],
  exports: [AuthService, TokenService, AuthGuard],
})
export class AuthModule {}
