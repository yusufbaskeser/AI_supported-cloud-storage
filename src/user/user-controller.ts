import {
  Controller,
  Get,
  Put,
  Delete,
  Param,
  Body,
} from '@nestjs/common';

import { UserService } from './user-service';

import { UserResponseDto } from './dto/userResponseDto';
import { UserUpdateRequestDto } from './dto/userUpdateRequestDto';
import { UserUpdateResponseDto } from './dto/userUpdateResponseDto';
import { UserDeleteResponseDto } from './dto/userDeleteResponseDto';

@Controller({ path: 'users', version: '1' })
export class UserController {
  constructor(private readonly userService: UserService) {}


 @Get('/users')
  getUsers(): Promise<UserResponseDto[]> {
    return this.userService.getUsers();
  }

  @Get(':id')
  getUser(@Param('id') id: number): Promise<UserResponseDto> {
    return this.userService.getUser(Number(id));
  }

  @Put(':id')
  updateUser(
    @Param('id') id: number,
    @Body() dto: UserUpdateRequestDto,
  ): Promise<UserUpdateResponseDto> {
    return this.userService.updateUser(Number(id), dto);
  }

  @Delete(':id')
  deleteUser(
    @Param('id') id: number,
  ): Promise<UserDeleteResponseDto> {
    return this.userService.deleteUser(Number(id));
  }
}
