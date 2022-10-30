import {
  Catch,
  ExceptionFilter,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { TypeORMError } from 'typeorm';
import { throwError } from 'rxjs';
import { getResponse } from '../functions';

@Catch(TypeORMError)
export class TypeormExceptionFilter implements ExceptionFilter {
  #logger = new Logger(TypeormExceptionFilter.name);

  catch(exception: TypeORMError) {
    this.#logger.error(`${exception.name}: ${exception.message}`);
    const grpcException = new InternalServerErrorException(exception.message);
    return throwError(() => getResponse(grpcException));
  }
}
