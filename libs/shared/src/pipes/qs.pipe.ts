import { Injectable, PipeTransform } from '@nestjs/common';
import * as qs from 'qs';

@Injectable()
export class QsPipe implements PipeTransform {
  transform(value: any, options?: any): any {
    return qs.parse(value, options);
  }
}
