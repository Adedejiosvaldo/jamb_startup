import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import { AuthedRequest } from '../auth/auth.guard';
import { Staff } from '../auth/staff.guard';
import { ParentReportService } from './parent-report.service';

/** No-login parent pages (token in URL). */
@Controller('v1/parent')
export class ParentPublicController {
  constructor(private readonly reports: ParentReportService) {}

  @Get('link/:token')
  link(@Param('token') token: string) {
    return this.reports.linkInfo(token);
  }

  @Post('link/:token/opt-in')
  @HttpCode(200)
  optIn(@Param('token') token: string) {
    return this.reports.optIn(token);
  }

  @Post('link/:token/opt-out')
  @HttpCode(200)
  optOut(@Param('token') token: string) {
    return this.reports.optOut(token);
  }

  @Get('report/:token')
  report(@Param('token') token: string) {
    return this.reports.publicReport(token);
  }
}

@Controller('v1/admin/parent-reports')
@Staff('admin')
export class ParentReportsAdminController {
  constructor(private readonly reports: ParentReportService) {}

  @Get('due')
  due() {
    return this.reports.due();
  }

  @Post(':linkId/mark-sent')
  @HttpCode(200)
  markSent(@Req() req: AuthedRequest, @Param('linkId', ParseUUIDPipe) linkId: string) {
    return this.reports.markSent(req.auth.userId, linkId);
  }
}
