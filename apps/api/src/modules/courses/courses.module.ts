import { Module } from '@nestjs/common'
import { StorageModule } from '../storage/storage.module'
import { CoursesController } from './courses.controller'
import { CoursesService } from './courses.service'

@Module({
  imports: [StorageModule],
  controllers: [CoursesController],
  providers: [CoursesService],
  exports: [CoursesService],
})
export class CoursesModule {}
