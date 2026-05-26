import { Controller, Get, UseGuards } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { AnalyticsService } from './analytics.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { UserRole, AuthUser } from '@assessiq/types'

@ApiTags('analytics')
@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ORG_ADMIN, UserRole.TEACHER)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Org/teacher overview stats' })
  getOverview(@CurrentUser() user: AuthUser) {
    return this.analyticsService.getOverview(user)
  }

  @Get('score-distribution')
  @ApiOperation({ summary: 'Score distribution in 10% bands' })
  getScoreDistribution(@CurrentUser() user: AuthUser) {
    return this.analyticsService.getScoreDistribution(user)
  }

  @Get('assessments')
  @ApiOperation({ summary: 'Per-assessment leaderboard with avg scores' })
  getAssessmentLeaderboard(@CurrentUser() user: AuthUser) {
    return this.analyticsService.getAssessmentLeaderboard(user)
  }

  @Get('recent-activity')
  @ApiOperation({ summary: 'Recent completed attempts' })
  getRecentActivity(@CurrentUser() user: AuthUser) {
    return this.analyticsService.getRecentActivity(user)
  }

  @Get('courses')
  @ApiOperation({ summary: 'Per-course breakdown' })
  getCourseBreakdown(@CurrentUser() user: AuthUser) {
    return this.analyticsService.getCourseBreakdown(user)
  }
}
