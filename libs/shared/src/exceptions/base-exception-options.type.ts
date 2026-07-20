import { ObjectLiteral } from '../types';

export interface BaseExceptionOptions {
  cause?: Error;
  context?: ObjectLiteral;
}
