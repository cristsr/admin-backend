import { Type } from '@nestjs/common';
import { map, pipe } from 'rxjs';

function mapper<T>(classRef: Type<T>, value: any): T;
function mapper<T>(classRef: Type<T>, value: any[]): T[];
function mapper<T>(classRef: Type<T>, value) {
  return Array.isArray(value)
    ? value.map((v) => new classRef(v))
    : new classRef(value);
}

export function mapTo<T>(classRef: Type<T>): any {
  return pipe(map((value) => mapper(classRef, value)));
}
