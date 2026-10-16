import { Global, Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { MfaController } from './mfa.controller';
import { OptionalAuthGuard } from './optional-auth.guard';
import { StaffGuard } from './staff.guard';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import { TokenService } from './token.service';

@Global()
@Module({
  controllers: [AuthController, MfaController],
  providers: [OtpService, TokenService, AuthService, AuthGuard, StaffGuard, OptionalAuthGuard],
  exports: [AuthService, TokenService, AuthGuard, StaffGuard, OptionalAuthGuard],
})
export class AuthModule {}
