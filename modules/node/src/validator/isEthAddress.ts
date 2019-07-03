import { registerDecorator, ValidationOptions } from "class-validator";

import { EthAddressRegex } from "../constants";

// tslint:disable-next-line:function-name
export function IsEthAddress(validationOptions?: ValidationOptions): Function {
  return function(object: Object, propertyName: string): void {
    registerDecorator({
      name: "isEthAddress",
      options: validationOptions,
      propertyName,
      target: object.constructor,
      validator: {
        validate(value: any): boolean {
          return typeof value === "string" && EthAddressRegex.test(value);
        },
      },
    });
  };
}