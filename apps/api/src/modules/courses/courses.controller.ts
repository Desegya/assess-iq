import { Controller } from '@nestjs/common'
import { UcoursesService } from './courses.service'

@Controller('courses')
export class UcoursesController {
  constructor(private readonly coursesService: UcoursesService) {}
}
