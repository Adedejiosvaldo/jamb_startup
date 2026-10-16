import { Module } from '@nestjs/common';
import {
  ContentAdminController,
  ContentPublishController,
  QuestionReportController,
} from './content.controller';
import { ContentService } from './content.service';

@Module({
  // Publish controller first so `questions/publish` isn't captured by `questions/:id`.
  controllers: [ContentPublishController, ContentAdminController, QuestionReportController],
  providers: [ContentService],
})
export class ContentModule {}
