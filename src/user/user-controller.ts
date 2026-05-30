import { Controller, Get, Put, Delete, Param, Body, UseInterceptors, UseGuards } from '@nestjs/common';
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
  getUser(@Param('id') id: number): Promise<UserResponseDto> {
    return this.userService.getUser(Number(id));
  }

  @Put(':id')
  updateUser(@Param('id') id: number, @Body() dto: UserUpdateRequestDto): Promise<UserUpdateResponseDto> {
    return this.userService.updateUser(Number(id), dto);
  }

  @Delete(':id')
  deleteUser(@Param('id') id: number): Promise<UserDeleteResponseDto> {
    return this.userService.deleteUser(Number(id));
  }
}
