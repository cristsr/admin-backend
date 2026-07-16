import { Injectable } from '@nestjs/common';
import { MovementRepository } from '../../domain/movement';

@Injectable()
export class RemoveMovementUsecase {
  constructor(private readonly movementRepository: MovementRepository) {}

  async execute(id: number, user: number): Promise<boolean> {
    return this.movementRepository.remove(id, user);
  }
}
