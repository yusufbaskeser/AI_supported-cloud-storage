import {
  Controller,
  Get,
  Put,
  Delete,
  Param,
  Body,
  Request,
  UseInterceptors,
  UseGuards,
  ForbiddenException,
  ParseIntPipe,
} from '@nestjs/common';
import { UserService } from './user-service';
import { UserResponseDto } from './dto/userResponseDto';
import { UserUpdateRequestDto } from './dto/userUpdateRequestDto';
import { UserUpdateResponseDto } from './dto/userUpdateResponseDto';
import { UserDeleteResponseDto } from './dto/userDeleteResponseDto';
import { JwtAuthGuard } from '../guard/jwt-auth-guard';
import { UserCacheInterceptor } from '../interceptors/redisInterceptor';

@UseGuards(JwtAuthGuard)
@Controller({ path: 'users', version: '1' })
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get(':id')
  @UseInterceptors(UserCacheInterceptor)
  getUser(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
  ): Promise<UserResponseDto> {
    if (req.user?.user_id !== id) {
      throw new ForbiddenException('You can only access your own profile');
    }
    return this.userService.getUser(id);
  }

  @Put(':id')
  updateUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UserUpdateRequestDto,
    @Request() req,
  ): Promise<UserUpdateResponseDto> {
    if (req.user?.user_id !== id) {
      throw new ForbiddenException('You can only update your own profile');
    }
    return this.userService.updateUser(id, dto);
  }

  @Delete(':id')
  deleteUser(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
  ): Promise<UserDeleteResponseDto> {
    if (req.user?.user_id !== id) {
      throw new ForbiddenException('You can only delete your own profile');
    }
    return this.userService.deleteUser(id);
  }
}
