import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GatewayTimeoutException,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { status } from '@grpc/grpc-js';
import { createHttpException } from './utils';

export const HttpToGrpcExceptionMap: Record<number, number> = {
  // standard gRPC error mapping
  // https://cloud.google.com/apis/design/errors#handling_errors
  [HttpStatus.BAD_REQUEST]: status.INVALID_ARGUMENT,
  [HttpStatus.UNAUTHORIZED]: status.UNAUTHENTICATED,
  [HttpStatus.FORBIDDEN]: status.PERMISSION_DENIED,
  [HttpStatus.NOT_FOUND]: status.NOT_FOUND,
  [HttpStatus.CONFLICT]: status.ALREADY_EXISTS,
  [HttpStatus.GONE]: status.ABORTED,
  [HttpStatus.TOO_MANY_REQUESTS]: status.RESOURCE_EXHAUSTED,
  499: status.CANCELLED,
  [HttpStatus.INTERNAL_SERVER_ERROR]: status.INTERNAL,
  [HttpStatus.NOT_IMPLEMENTED]: status.UNIMPLEMENTED,
  [HttpStatus.BAD_GATEWAY]: status.UNKNOWN,
  [HttpStatus.SERVICE_UNAVAILABLE]: status.UNAVAILABLE,
  [HttpStatus.GATEWAY_TIMEOUT]: status.DEADLINE_EXCEEDED,

  // additional built-in http exceptions
  // https://docs.nestjs.com/exception-filters#built-in-http-exceptions
  [HttpStatus.HTTP_VERSION_NOT_SUPPORTED]: status.UNAVAILABLE,
  [HttpStatus.PAYLOAD_TOO_LARGE]: status.OUT_OF_RANGE,
  [HttpStatus.UNSUPPORTED_MEDIA_TYPE]: status.CANCELLED,
  [HttpStatus.UNPROCESSABLE_ENTITY]: status.CANCELLED,
  [HttpStatus.I_AM_A_TEAPOT]: status.UNKNOWN,
  [HttpStatus.METHOD_NOT_ALLOWED]: status.CANCELLED,
  [HttpStatus.PRECONDITION_FAILED]: status.FAILED_PRECONDITION,
};

export const GrpcToHttpExceptionMap: Record<any, any> = {
  [status.CANCELLED]: createHttpException(499, 'Client Closed Request'),
  [status.UNKNOWN]: InternalServerErrorException,
  [status.INVALID_ARGUMENT]: BadRequestException,
  [status.DEADLINE_EXCEEDED]: GatewayTimeoutException,
  [status.NOT_FOUND]: NotFoundException,
  [status.ALREADY_EXISTS]: ConflictException,
  [status.PERMISSION_DENIED]: ForbiddenException,
  [status.UNAUTHENTICATED]: UnauthorizedException,
  [status.RESOURCE_EXHAUSTED]: createHttpException(429, 'Too Many Request'),
  [status.FAILED_PRECONDITION]: BadRequestException,
  [status.DEADLINE_EXCEEDED]: GatewayTimeoutException,
  [status.ABORTED]: ConflictException,
  [status.OUT_OF_RANGE]: BadRequestException,
  [status.UNIMPLEMENTED]: createHttpException(501, 'Not Implemented'),
  [status.INTERNAL]: InternalServerErrorException,
  [status.UNAVAILABLE]: ServiceUnavailableException,
  [status.DATA_LOSS]: InternalServerErrorException,
};
