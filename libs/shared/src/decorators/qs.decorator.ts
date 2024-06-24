import { Query } from '@nestjs/common';
import { QsPipe } from '../pipes';

export function Qs(): ParameterDecorator {
  return Query(QsPipe);
}
