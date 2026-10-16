import { Controller, Get, Param, ParseIntPipe, ParseUUIDPipe, Query } from '@nestjs/common';
import { CatalogueService } from './catalogue.service';

/** Public reference data (no auth) — powers the subject checker (F-ACQ-01). */
@Controller('v1')
export class CatalogueController {
  constructor(private readonly catalogue: CatalogueService) {}

  @Get('subjects')
  subjects() {
    return this.catalogue.subjects();
  }

  @Get('subjects/:code/topics')
  topics(@Param('code') code: string) {
    return this.catalogue.topics(code.toUpperCase());
  }

  @Get('universities')
  universities() {
    return this.catalogue.universities();
  }

  @Get('courses')
  courses(@Query('university') university?: string) {
    return this.catalogue.courses(university || undefined);
  }

  @Get('requirements')
  requirement(
    @Query('university', ParseUUIDPipe) university: string,
    @Query('course', ParseUUIDPipe) course: string,
  ) {
    return this.catalogue.requirement(university, course);
  }

  @Get('exam-config/:year')
  examConfig(@Param('year', ParseIntPipe) year: number) {
    return this.catalogue.examConfig(year);
  }

  @Get('announcements')
  announcements() {
    return this.catalogue.announcements();
  }
}
