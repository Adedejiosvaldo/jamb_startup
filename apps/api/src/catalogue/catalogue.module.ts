import { Module } from '@nestjs/common';
import { CatalogueAdminController } from './catalogue-admin.controller';
import { CatalogueController } from './catalogue.controller';
import { CatalogueService } from './catalogue.service';

@Module({
  controllers: [CatalogueController, CatalogueAdminController],
  providers: [CatalogueService],
  exports: [CatalogueService],
})
export class CatalogueModule {}
