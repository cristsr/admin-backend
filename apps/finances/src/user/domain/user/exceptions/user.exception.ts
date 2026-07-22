import { DomainConflictException, DomainNotFoundException } from '@shared';

export class UserNotFoundException extends DomainNotFoundException {}

export class UserAlreadyExistsException extends DomainConflictException {}
