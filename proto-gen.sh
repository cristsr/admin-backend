#!/bin/bash

npm proto-loader-gen-types --grpcLib=@grpc/grpc-js --outDir=libs/grpc/src/proto/ libs/grpc/src/*.proto
