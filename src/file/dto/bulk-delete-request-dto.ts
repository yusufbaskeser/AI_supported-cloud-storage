import { IsArray, IsNotEmpty, IsNumber } from 'class-validator';

export class BulkDeleteRequestDto {
  @IsArray()
  @IsNotEmpty()
  @IsNumber({}, { each: true })
  file_ids: number[];
}