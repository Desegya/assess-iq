import { PartialType } from '@nestjs/swagger'
import { CreateCourseDto } from './create-course.dto'

// A real class (not a TS Partial<>) so the ValidationPipe validates and whitelists the body
export class UpdateCourseDto extends PartialType(CreateCourseDto) {}
