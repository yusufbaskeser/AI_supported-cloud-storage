import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  Query,
  Request,
  UseInterceptors,
  UploadedFiles,
  UseGuards,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { FileService } from './file-service';
import { UpdateFilenameRequestDto } from './dto/update-fileName-request-dto';
import { FileResponseDto } from './dto/file-response-dto';
import { DeleteFileResponseDto } from './dto/delete-file-response-dto';
import { BulkDeleteRequestDto } from './dto/bulk-delete-request-dto';
import { JwtAuthGuard } from '../guard/jwt-auth-guard';
import { UserCacheInterceptor } from '../interceptors/redisInterceptor';

@UseGuards(JwtAuthGuard)
@Controller({ path: 'files', version: '1' })
export class FileController {
  constructor(private readonly fileService: FileService) {}

  @Post('workspaces/:workspace_id/files')
  @Throttle({ default: { limit: 20, ttl: 60 } })
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      limits: { fileSize: 50 * 1024 * 1024 },
    }),
  )
  async uploadFiles(
    @Param('workspace_id', ParseIntPipe) workspace_id: number,
    @UploadedFiles() files: Express.Multer.File[],
    @Request() req,
  ) {
    files?.forEach((f) => {
      f.originalname = Buffer.from(f.originalname, 'latin1').toString('utf8');
    });
    return this.fileService.uploadFiles(files, workspace_id, req.user.user_id);
  }

  @Get('workspaces/:workspace_id/files')
  async getFiles(
    @Param('workspace_id', ParseIntPipe) workspace_id: number,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Request() req,
  ) {
    return this.fileService.findFilesByWorkspace(
      workspace_id,
      req.user.user_id,
      Number(page),
      Number(limit),
    );
  }

  @Get(':file_id/url')
  async getFileUrl(
    @Param('file_id', ParseIntPipe) file_id: number,
    @Request() req,
  ) {
    const url = await this.fileService.getFileUrl(file_id, req.user.user_id);
    return { url };
  }

  @Get(':file_id/download')
  async getFileDownloadUrl(
    @Param('file_id', ParseIntPipe) file_id: number,
    @Request() req,
  ) {
    const url = await this.fileService.getFileDownloadUrl(
      file_id,
      req.user.user_id,
    );
    return { url };
  }

  @Get(':file_id/share')
  async generateShareUrl(
    @Param('file_id', ParseIntPipe) file_id: number,
    @Query('expiry') expiry: string,
    @Request() req,
  ) {
    return this.fileService.generateShareUrl(
      file_id,
      req.user.user_id,
      Number(expiry) || 3600,
    );
  }

  @Put(':file_id')
  async updateFilename(
    @Param('file_id', ParseIntPipe) file_id: number,
    @Body() updateDto: UpdateFilenameRequestDto,
    @Request() req,
  ): Promise<FileResponseDto> {
    return this.fileService.updateFilename(
      file_id,
      updateDto.filename,
      req.user.user_id,
    );
  }

  @Delete('bulk-delete')
  async bulkDeleteFiles(
    @Body() deleteDto: BulkDeleteRequestDto,
    @Request() req,
  ): Promise<DeleteFileResponseDto> {
    return this.fileService.bulkDelete(deleteDto.file_ids, req.user.user_id);
  }
}
