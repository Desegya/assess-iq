import { Module } from '@nestjs/common'
import { UcoursesController } from './courses.controller'
import { UcoursesService } from './courses.service'

@Module({
  controllers: [UcoursesController],
  providers: [UcoursesService],
  exports: [UcoursesService],
})
export class UcoursesModule {}
