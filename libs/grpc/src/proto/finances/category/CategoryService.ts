// Original file: libs/grpc/src/finances/category/category.proto

import type * as grpc from '@grpc/grpc-js'
import type { MethodDefinition } from '@grpc/proto-loader'
import type { Category as _finances_category_Category, Category__Output as _finances_category_Category__Output } from '../../finances/category/Category';
import type { CategoryId as _finances_category_CategoryId, CategoryId__Output as _finances_category_CategoryId__Output } from '../../finances/category/CategoryId';
import type { CreateCategory as _finances_category_CreateCategory, CreateCategory__Output as _finances_category_CreateCategory__Output } from '../../finances/category/CreateCategory';
import type { Empty as _google_protobuf_Empty, Empty__Output as _google_protobuf_Empty__Output } from '../../google/protobuf/Empty';
import type { UpdateCategory as _finances_category_UpdateCategory, UpdateCategory__Output as _finances_category_UpdateCategory__Output } from '../../finances/category/UpdateCategory';

export interface CategoryServiceClient extends grpc.Client {
  create(argument: _finances_category_CreateCategory, metadata: grpc.Metadata, options?: grpc.CallOptions): grpc.ClientReadableStream<_finances_category_Category__Output>;
  create(argument: _finances_category_CreateCategory, options?: grpc.CallOptions): grpc.ClientReadableStream<_finances_category_Category__Output>;
  create(argument: _finances_category_CreateCategory, metadata: grpc.Metadata, options?: grpc.CallOptions): grpc.ClientReadableStream<_finances_category_Category__Output>;
  create(argument: _finances_category_CreateCategory, options?: grpc.CallOptions): grpc.ClientReadableStream<_finances_category_Category__Output>;
  
  createMany(metadata: grpc.Metadata, options?: grpc.CallOptions): grpc.ClientDuplexStream<_finances_category_CreateCategory, _finances_category_Category__Output>;
  createMany(options?: grpc.CallOptions): grpc.ClientDuplexStream<_finances_category_CreateCategory, _finances_category_Category__Output>;
  createMany(metadata: grpc.Metadata, options?: grpc.CallOptions): grpc.ClientDuplexStream<_finances_category_CreateCategory, _finances_category_Category__Output>;
  createMany(options?: grpc.CallOptions): grpc.ClientDuplexStream<_finances_category_CreateCategory, _finances_category_Category__Output>;
  
  findAll(argument: _google_protobuf_Empty, metadata: grpc.Metadata, options?: grpc.CallOptions): grpc.ClientReadableStream<_finances_category_Category__Output>;
  findAll(argument: _google_protobuf_Empty, options?: grpc.CallOptions): grpc.ClientReadableStream<_finances_category_Category__Output>;
  findAll(argument: _google_protobuf_Empty, metadata: grpc.Metadata, options?: grpc.CallOptions): grpc.ClientReadableStream<_finances_category_Category__Output>;
  findAll(argument: _google_protobuf_Empty, options?: grpc.CallOptions): grpc.ClientReadableStream<_finances_category_Category__Output>;
  
  findOne(argument: _finances_category_CategoryId, metadata: grpc.Metadata, options?: grpc.CallOptions): grpc.ClientReadableStream<_finances_category_Category__Output>;
  findOne(argument: _finances_category_CategoryId, options?: grpc.CallOptions): grpc.ClientReadableStream<_finances_category_Category__Output>;
  findOne(argument: _finances_category_CategoryId, metadata: grpc.Metadata, options?: grpc.CallOptions): grpc.ClientReadableStream<_finances_category_Category__Output>;
  findOne(argument: _finances_category_CategoryId, options?: grpc.CallOptions): grpc.ClientReadableStream<_finances_category_Category__Output>;
  
  remove(argument: _finances_category_CategoryId, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_finances_category_Category__Output>): grpc.ClientUnaryCall;
  remove(argument: _finances_category_CategoryId, metadata: grpc.Metadata, callback: grpc.requestCallback<_finances_category_Category__Output>): grpc.ClientUnaryCall;
  remove(argument: _finances_category_CategoryId, options: grpc.CallOptions, callback: grpc.requestCallback<_finances_category_Category__Output>): grpc.ClientUnaryCall;
  remove(argument: _finances_category_CategoryId, callback: grpc.requestCallback<_finances_category_Category__Output>): grpc.ClientUnaryCall;
  remove(argument: _finances_category_CategoryId, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_finances_category_Category__Output>): grpc.ClientUnaryCall;
  remove(argument: _finances_category_CategoryId, metadata: grpc.Metadata, callback: grpc.requestCallback<_finances_category_Category__Output>): grpc.ClientUnaryCall;
  remove(argument: _finances_category_CategoryId, options: grpc.CallOptions, callback: grpc.requestCallback<_finances_category_Category__Output>): grpc.ClientUnaryCall;
  remove(argument: _finances_category_CategoryId, callback: grpc.requestCallback<_finances_category_Category__Output>): grpc.ClientUnaryCall;
  
  removeAll(argument: _google_protobuf_Empty, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_finances_category_Category__Output>): grpc.ClientUnaryCall;
  removeAll(argument: _google_protobuf_Empty, metadata: grpc.Metadata, callback: grpc.requestCallback<_finances_category_Category__Output>): grpc.ClientUnaryCall;
  removeAll(argument: _google_protobuf_Empty, options: grpc.CallOptions, callback: grpc.requestCallback<_finances_category_Category__Output>): grpc.ClientUnaryCall;
  removeAll(argument: _google_protobuf_Empty, callback: grpc.requestCallback<_finances_category_Category__Output>): grpc.ClientUnaryCall;
  removeAll(argument: _google_protobuf_Empty, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_finances_category_Category__Output>): grpc.ClientUnaryCall;
  removeAll(argument: _google_protobuf_Empty, metadata: grpc.Metadata, callback: grpc.requestCallback<_finances_category_Category__Output>): grpc.ClientUnaryCall;
  removeAll(argument: _google_protobuf_Empty, options: grpc.CallOptions, callback: grpc.requestCallback<_finances_category_Category__Output>): grpc.ClientUnaryCall;
  removeAll(argument: _google_protobuf_Empty, callback: grpc.requestCallback<_finances_category_Category__Output>): grpc.ClientUnaryCall;
  
  update(argument: _finances_category_UpdateCategory, metadata: grpc.Metadata, options?: grpc.CallOptions): grpc.ClientReadableStream<_finances_category_Category__Output>;
  update(argument: _finances_category_UpdateCategory, options?: grpc.CallOptions): grpc.ClientReadableStream<_finances_category_Category__Output>;
  update(argument: _finances_category_UpdateCategory, metadata: grpc.Metadata, options?: grpc.CallOptions): grpc.ClientReadableStream<_finances_category_Category__Output>;
  update(argument: _finances_category_UpdateCategory, options?: grpc.CallOptions): grpc.ClientReadableStream<_finances_category_Category__Output>;
  
}

export interface CategoryServiceHandlers extends grpc.UntypedServiceImplementation {
  create: grpc.handleServerStreamingCall<_finances_category_CreateCategory__Output, _finances_category_Category>;
  
  createMany: grpc.handleBidiStreamingCall<_finances_category_CreateCategory__Output, _finances_category_Category>;
  
  findAll: grpc.handleServerStreamingCall<_google_protobuf_Empty__Output, _finances_category_Category>;
  
  findOne: grpc.handleServerStreamingCall<_finances_category_CategoryId__Output, _finances_category_Category>;
  
  remove: grpc.handleUnaryCall<_finances_category_CategoryId__Output, _finances_category_Category>;
  
  removeAll: grpc.handleUnaryCall<_google_protobuf_Empty__Output, _finances_category_Category>;
  
  update: grpc.handleServerStreamingCall<_finances_category_UpdateCategory__Output, _finances_category_Category>;
  
}

export interface CategoryServiceDefinition extends grpc.ServiceDefinition {
  create: MethodDefinition<_finances_category_CreateCategory, _finances_category_Category, _finances_category_CreateCategory__Output, _finances_category_Category__Output>
  createMany: MethodDefinition<_finances_category_CreateCategory, _finances_category_Category, _finances_category_CreateCategory__Output, _finances_category_Category__Output>
  findAll: MethodDefinition<_google_protobuf_Empty, _finances_category_Category, _google_protobuf_Empty__Output, _finances_category_Category__Output>
  findOne: MethodDefinition<_finances_category_CategoryId, _finances_category_Category, _finances_category_CategoryId__Output, _finances_category_Category__Output>
  remove: MethodDefinition<_finances_category_CategoryId, _finances_category_Category, _finances_category_CategoryId__Output, _finances_category_Category__Output>
  removeAll: MethodDefinition<_google_protobuf_Empty, _finances_category_Category, _google_protobuf_Empty__Output, _finances_category_Category__Output>
  update: MethodDefinition<_finances_category_UpdateCategory, _finances_category_Category, _finances_category_UpdateCategory__Output, _finances_category_Category__Output>
}
