import type * as grpc from '@grpc/grpc-js';
import type { MessageTypeDefinition } from '@grpc/proto-loader';

import type { CategoryServiceClient as _finances_category_CategoryServiceClient, CategoryServiceDefinition as _finances_category_CategoryServiceDefinition } from './finances/category/CategoryService';

type SubtypeConstructor<Constructor extends new (...args: any) => any, Subtype> = {
  new(...args: ConstructorParameters<Constructor>): Subtype;
};

export interface ProtoGrpcType {
  finances: {
    category: {
      Category: MessageTypeDefinition
      CategoryId: MessageTypeDefinition
      CategoryService: SubtypeConstructor<typeof grpc.Client, _finances_category_CategoryServiceClient> & { service: _finances_category_CategoryServiceDefinition }
      CreateCategories: MessageTypeDefinition
      CreateCategory: MessageTypeDefinition
      UpdateCategory: MessageTypeDefinition
    }
  }
  google: {
    protobuf: {
      Empty: MessageTypeDefinition
    }
  }
}

