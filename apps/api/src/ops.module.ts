import { Module } from '@nestjs/common';
import { AdminController } from './admin/admin.controller';
import { CommerceModule } from './commerce/commerce.module';
import { EventsController } from './events/events.controller';
import { ParentPublicController, ParentReportsAdminController } from './parents/parents.controller';
import { ParentReportService } from './parents/parent-report.service';
import { ProfileService } from './profile/profile.service';
import { SchoolsController } from './schools/schools.controller';
import { SchoolsService } from './schools/schools.service';
import { SupportAdminController, SupportController } from './support/support.controller';
import {
  ClassJoinController,
  TeacherController,
  TeacherGuard,
  TeachersAdminController,
} from './teachers/teachers.controller';

/** Operations surfaces: support, parents, schools, teachers, admin users, analytics. */
@Module({
  imports: [CommerceModule],
  controllers: [
    AdminController,
    EventsController,
    ParentPublicController,
    ParentReportsAdminController,
    SchoolsController,
    SupportController,
    SupportAdminController,
    TeacherController,
    ClassJoinController,
    TeachersAdminController,
  ],
  providers: [ParentReportService, SchoolsService, ProfileService, TeacherGuard],
})
export class OpsModule {}
