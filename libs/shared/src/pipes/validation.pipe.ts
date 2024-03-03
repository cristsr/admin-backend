import {
  ArgumentMetadata,
  Inject,
  Injectable,
  ValidationPipe as NestValidationPipe,
  Scope,
  Type,
} from '@nestjs/common';
import { HttpErrorByCode } from '@nestjs/common/utils/http-error-by-code.util';
import { ContextIdFactory, ModuleRef, REQUEST, Reflector } from '@nestjs/core';
import { TypeMetadataStorage } from '@nestjs/graphql';
import { isEmpty } from 'lodash';
import { lastValueFrom } from 'rxjs';
import { RESOLVE_ENTITY, WITH_ENTITY } from '../constants';

@Injectable({ scope: Scope.REQUEST })
export class ValidationPipe extends NestValidationPipe {
  constructor(
    private reflector: Reflector,
    @Inject(REQUEST) private request: Record<string, unknown>,
    private moduleRef: ModuleRef
  ) {
    super({
      transform: true,
      forbidUnknownValues: false,
    });
  }

  async transform(value: any, metadata: ArgumentMetadata) {
    try {
      // console.log(this.context);
      const transformed = await super.transform(value, metadata);

      const resolveEntity = this.reflector.get(
        RESOLVE_ENTITY,
        transformed.constructor
      );

      if (!resolveEntity) {
        return transformed;
      }

      await this.resolveEntities(transformed);

      return transformed;

      // Do something with the transformed value
    } catch (e) {
      throw e;
    }
  }

  async resolveEntities(target: any) {
    for (const [key, value] of Object.entries(target)) {
      const metadata = Reflect.getMetadata(WITH_ENTITY, target, key);

      if (!metadata) {
        continue;
      }

      if (!value && metadata.opts?.nullable) {
        continue;
      }

      const queries = TypeMetadataStorage.getQueriesMetadata();

      const query = queries.find((q) => {
        return q.typeFn() === metadata.type() && !q.returnTypeOptions.isArray;
      });

      const resolver = await this.moduleRef.create(
        query.target as Type,
        ContextIdFactory.getByRequest(this.request)
      );

      const entity = await lastValueFrom(
        resolver[query.methodName](null, value)
      ).then((res) => (isEmpty(res as any) ? null : res));

      // console.log('resolver', resolver);
      //
      console.log('query', query);

      console.log('entity', entity);

      if (!entity) {
        if (metadata.opts?.nullable) {
          target[key] = null;
          continue;
        }

        throw new HttpErrorByCode[this.errorHttpStatusCode]([
          'Entity not found',
        ]);
      }

      target[key] = entity;
    }
  }
}
