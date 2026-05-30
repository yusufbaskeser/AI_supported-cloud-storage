import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { join } from 'path';

@Controller()
export class AppController {
  @Get()
  root(@Res() res: Response) {
    res.sendFile(join(process.cwd(), 'frontend', 'index.html'));
  }
}
