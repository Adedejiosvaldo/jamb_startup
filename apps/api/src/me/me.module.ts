import { Module } from '@nestjs/common';
import { CommerceModule } from '../commerce/commerce.module';
import { ProfileService } from '../profile/profile.service';
import { MeController } from './me.controller';

@Module({ imports: [CommerceModule], controllers: [MeController], providers: [ProfileService] })
export class MeModule {}
