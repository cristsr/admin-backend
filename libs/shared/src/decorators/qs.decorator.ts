import { Query } from '@nestjs/common';
import { QsPipe } from '../pipes';

export function Qs(): ParameterDecorator {
  console.log('Qs Decorator');
  return Query(QsPipe);
}
