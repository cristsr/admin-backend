import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';

export function createExecutionContext(req, type) {
  const context = new ExecutionContextHost([req]);

  context.setType(type);

  return context;
}
