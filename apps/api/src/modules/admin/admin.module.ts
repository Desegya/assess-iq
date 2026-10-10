import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { AdminAuthController } from './admin-auth.controller'
import { AdminController } from './admin.controller'
import { NightklassAdminGuard } from './admin.guard'
import { AdminService } from './admin.service'

@Module({
  imports: [AuthModule],
  controllers: [AdminController, AdminAuthController],
  providers: [AdminService, NightklassAdminGuard],
  exports: [AdminService],
})
export class AdminModule {}
