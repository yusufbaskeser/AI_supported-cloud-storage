import {
  Controller,
  Get,
  Put,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { AdminService } from './admin-service';
import { UserRole } from '../entities/user-entity';
import { JwtAuthGuard } from '../guard/jwt-auth-guard';
import { AdminGuard } from '../guard/admin-guard';
import { EditorGuard } from '../guard/editor-guard';

@UseGuards(JwtAuthGuard, AdminGuard)
@Controller({ path: 'admin', version: '1' })
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard/stats')
  getStats() {
    return this.adminService.getSystemStats();
  }

  @Get('users/all')
  getAllUsers(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('dateFilter') dateFilter?: string,
    @Query('minWorkspaces') minWorkspaces?: string,
    @Query('maxWorkspaces') maxWorkspaces?: string,
    @Query('hasFiles') hasFiles?: string,
    @Query('search') search?: string,
  ) {
    return this.adminService.findAllUsers(page, limit, {
      dateFilter: dateFilter as 'today' | 'week' | 'month' | undefined,
      minWorkspaces: minWorkspaces !== undefined ? +minWorkspaces : undefined,
      maxWorkspaces: maxWorkspaces !== undefined ? +maxWorkspaces : undefined,
      hasFiles: hasFiles as 'yes' | 'no' | undefined,
      search,
    });
  }

  @Get('users/search')
  searchUsers(@Query('q') query: string) {
    return this.adminService.searchUsers(query);
  }

  @Get('users/:id/detail')
  getUserDetail(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.findUserDetail(id);
  }

  @Get('users/:id/workspaces')
  getUserWorkspaces(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.findWorkspacesByUser(id);
  }

  @Get('users/:id/chats')
  getUserChats(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.getUserChats(id);
  }

  @UseGuards(EditorGuard)
  @Put('users/:id/role')
  updateRole(
    @Param('id', ParseIntPipe) id: number,
    @Body('role') newRole: UserRole,
  ) {
    return this.adminService.changeUserRole(id, newRole);
  }

  @UseGuards(EditorGuard)
  @Put('users/:id/storage-limit')
  updateStorageLimit(
    @Param('id', ParseIntPipe) id: number,
    @Body('limitGB') limitGB: number,
  ) {
    return this.adminService.updateStorageLimit(
      id,
      Math.round(limitGB * 1024 ** 3),
    );
  }

  @UseGuards(EditorGuard)
  @Put('users/:id/verify')
  verifyUser(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.verifyUser(id);
  }

  @Delete('users/:id/hard-delete')
  removeUser(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.deleteUser(id);
  }

  @Get('workspaces/all')
  getAllWorkspaces(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.adminService.findAllWorkspaces(page, limit);
  }

  @Get('workspaces/:id/files')
  getWorkspaceFiles(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.findFilesByWorkspace(id);
  }

  @Delete('workspaces/:id')
  removeWorkspace(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.forceDeleteWorkspace(id);
  }

  @Get('files/untagged')
  getUntaggedFiles() {
    return this.adminService.findFilesWithoutTags();
  }

  @Get('files/search-by-tag')
  searchFilesByTag(@Query('tag') tag: string) {
    return this.adminService.findFilesByTag(tag);
  }

  @Delete('files/:id/force-delete')
  removeFile(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.forceDeleteFile(id);
  }
}
