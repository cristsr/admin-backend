import { CreateBillDto } from './create-bill.dto';
import { PartialType } from '@nestjs/mapped-types';

export class UpdateBillDto extends PartialType(CreateBillDto) {}
