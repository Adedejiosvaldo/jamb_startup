import { Module } from '@nestjs/common';
import { CommerceModule } from '../commerce/commerce.module';
import { LearningController } from '../learning/learning.controller';
import { LearningService } from '../learning/learning.service';
import { TestsController } from './tests.controller';
import { TestsService } from './tests.service';

@Module({
  imports: [CommerceModule],
  controllers: [TestsController, LearningController],
  providers: [TestsService, LearningService],
  exports: [TestsService, LearningService],
})
export class TestsModule {}
