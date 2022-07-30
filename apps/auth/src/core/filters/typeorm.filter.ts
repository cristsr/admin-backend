import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { TypeORMError } from 'typeorm';

@Catch(TypeORMError)
export class TypeormFilter implements ExceptionFilter {
  #logger = new Logger(TypeormFilter.name);

  catch(exception: TypeORMError, host: ArgumentsHost) {
    this.#logger.error(`${exception.name}: ${exception.message}`);

    const ctx = host.switchToRpc();
    const response = ctx.getContext();

    const errorMap = {
      EntityNotFoundError: NotFoundException,
      QueryFailedError: UnprocessableEntityException,
      Default: InternalServerErrorException,
    };

    const error = errorMap[exception.name] || errorMap.Default;

    response.status(error.getStatus()).json(error.getResponse());
  }
}
