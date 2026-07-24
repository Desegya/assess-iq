import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Query,
  Body,
  UploadedFile,
  UseInterceptors,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiConsumes,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger'
import { DocumentsService } from './documents.service'
import { UploadDocumentDto } from './dto/upload-document.dto'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Roles } from '../auth/decorators/roles.decorator'
import { AuthUser, UserRole } from '@assessiq/types'

@ApiTags('Documents')
@ApiBearerAuth()
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  // ─── Upload ──────────────────────────────────────────────────────────────

  @Post('upload')
  @Roles(UserRole.TEACHER, UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN, UserRole.STUDENT)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload a document (PDF, DOCX, or TXT) and extract text' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        courseId: { type: 'string', nullable: true },
      },
    },
  })
  upload(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 20 * 1024 * 1024 }), // 20 MB
          new FileTypeValidator({
            fileType:
              /^(application\/pdf|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document|application\/msword|text\/plain)$/,
          }),
        ],
      }),
    )
    file: Express.Multer.File,
    @Body() dto: UploadDocumentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.documentsService.upload(file, dto, user)
  }

  // ─── List ────────────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'List all documents for the current organisation' })
  @ApiQuery({ name: 'courseId', required: false, description: 'Filter by course' })
  findAll(@CurrentUser() user: AuthUser, @Query('courseId') courseId?: string) {
    return this.documentsService.findAll(user, courseId)
  }

  // ─── Single ──────────────────────────────────────────────────────────────

  @Get(':id')
  @ApiOperation({ summary: 'Get document metadata' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.documentsService.findOne(id, user)
  }

  // ─── Download URL ─────────────────────────────────────────────────────────

  @Get(':id/download-url')
  @ApiOperation({ summary: 'Get a signed download URL for the document' })
  getDownloadUrl(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.documentsService.getDownloadUrl(id, user)
  }

  // ─── Extract topics ──────────────────────────────────────────────────────

  @Post(':id/extract-topics')
  @ApiOperation({ summary: 'Propose candidate topics from a ready document (AI, with a heuristic fallback)' })
  extractTopics(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.documentsService.extractTopics(id, user)
  }

  // ─── Delete ──────────────────────────────────────────────────────────────

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a document (uploader or ORG_ADMIN only)' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.documentsService.remove(id, user)
  }
}
