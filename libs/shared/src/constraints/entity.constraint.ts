import { Inject, Injectable, Optional, Scope } from '@nestjs/common';
import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { DataSource, ObjectLiteral, Repository } from 'typeorm';

@Injectable()
@ValidatorConstraint({ async: false })
export class EntityConstraint implements ValidatorConstraintInterface {
  constructor(@Optional() @Inject(DataSource) private datasource: DataSource) {}

  defaultMessage(validationArguments?: ValidationArguments): string {
    return validationArguments?.constraints.at(0) + ' does not exist';
  }

  async validate(
    value: any,
    validationArguments?: ValidationArguments
  ): Promise<boolean> {
    if (!this.datasource) {
      return true;
    }

    const entity = validationArguments.constraints.at(0);
    console.log('EntityConstraint.entity', entity());
    const repository = this.datasource.getRepository(entity());

    const entityExists = await repository.findOne({ where: { id: value } });

    console.log('EntityConstraint.validate', entityExists);

    value = entityExists;

    return !!entityExists;
  }
}
