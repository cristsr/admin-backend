import {
  ValidationArguments,
  ValidationOptions,
  registerDecorator,
} from 'class-validator';

export function IsDateString(validationOptions?: ValidationOptions) {
  return function (object: any, propertyName: string) {
    registerDecorator({
      name: 'custom',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        defaultMessage(validationArguments?: ValidationArguments): string {
          return `${validationArguments?.property} is not a valid date string`;
        },
        validate(value: any) {
          const validDates = [
            // yyyy
            /^\d{4}$/,
            // yyyy-MM
            /^\d{4}-\d{2}$/,
            // yyyy-MM-dd
            /^\d{4}-\d{2}-\d{2}$/,
            // iso8601
            /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z?\/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z?$/,
          ];

          return validDates.some((regex) => regex.test(value));
        },
      },
    });
  };
}
