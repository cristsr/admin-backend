import { Injectable } from '@nestjs/common';
import { CreateAuthInput } from 'domain/auth/dto';
import { UpdateAuthInput } from 'domain/auth/dto';
import { Auth } from 'domain/auth/entities';

@Injectable()
export class AuthService {
  create(createAuthInput: CreateAuthInput) {
    return 'This action adds a new auth';
  }

  findAll() {
    return `This action returns all auth`;
  }

  findOne(id: number) {
    const auth = new Auth();
    auth.exampleField = +id;
    return auth;
  }

  update(id: number, updateAuthInput: UpdateAuthInput) {
    return `This action updates a #${id} auth`;
  }

  remove(id: number) {
    return `This action removes a #${id} auth`;
  }
}
