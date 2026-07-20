import { DomainConflictException, DomainNotFoundException } from '@shared';

export class CategoryNotFoundException extends DomainNotFoundException {}

export class CategoryIsSystemException extends DomainConflictException {}
