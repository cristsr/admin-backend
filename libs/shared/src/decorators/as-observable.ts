import { Observable, from } from 'rxjs';

export function AsObservable() {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = function (...args: any[]): Observable<any> {
      return from(originalMethod.apply(this, args));
    };

    return descriptor;
  };
}
