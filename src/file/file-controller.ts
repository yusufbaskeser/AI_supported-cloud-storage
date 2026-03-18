import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Request,
  UseInterceptors,
  UploadedFiles,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { FileService } from './file-service';
import { UpdateFilenameRequestDto } from './dto/update-fileName-request-dto';
import { FileResponseDto } from './dto/file-response-dto';
import { DeleteFileResponseDto } from './dto/delete-file-response-dto';
import { BulkDeleteRequestDto } from './dto/bulk-delete-request-dto';
import express from 'express';

@Controller()
export class FileController {
  constructor(private readonly fileService: FileService) {}

  @Post('workspaces/:workspace_id/files')
  @UseInterceptors(FilesInterceptor('files', 10))
  async uploadFiles(
    @Param('workspace_id') workspace_id: number,
    @UploadedFiles() files: Express.Multer.File[],
    @Request() req,
  ): Promise<FileResponseDto[]> {
    return this.fileService.uploadFiles(files, workspace_id, req.user.user_id);
  }

  @Get('workspaces/:workspace_id/files')
  async getFiles(
    @Param('workspace_id') workspace_id: number,
    @Request() req,
  ): Promise<FileResponseDto[]> {
    return this.fileService.findFilesByWorkspace(workspace_id, req.user.user_id);
  }

  @Get('files/:file_id/download')
  async downloadFile(
    @Param('file_id') file_id: number,
    @Request() req,
    @Res({ passthrough: true }) res: express.Response,
  ) {
    const result = await this.fileService.downloadFile(file_id, req.user.user_id);

    res.set({
      'Content-Type': result.mimeType,
      'Content-Disposition': `attachment; filename="${result.filename}"`,
    });

    return new StreamableFile(result.stream);
  }

  @Put('files/:file_id')
  async updateFilename(
    @Param('file_id') file_id: number,
    @Body() updateDto: UpdateFilenameRequestDto,
    @Request() req,
  ): Promise<FileResponseDto> {
    return this.fileService.updateFilename(file_id, updateDto.filename, req.user.user_id);
  }

  @Delete('files/:file_id')
  async deleteFile(
    @Param('file_id') file_id: number,
    @Request() req,
  ): Promise<DeleteFileResponseDto> {
    return this.fileService.deleteFile(file_id, req.user.user_id);
  }


  @Delete('bulk-delete')
async bulkDeleteFiles(
  @Body() deleteDto: BulkDeleteRequestDto,
  @Request() req,
): Promise<DeleteFileResponseDto> {
  return this.fileService.bulkDelete(deleteDto.file_ids, req.user.user_id);
}
}