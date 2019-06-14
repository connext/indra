import { registerDecorator, ValidationOptions } from "class-validator";

import { EthAddressRegex } from "../constants";

// tslint:disable-next-line:function-name
export function IsEthAddress(validationOptions?: ValidationOptions) {
  return function(object: Object, propertyName: string) {
    registerDecorator({
      name: "isEthAddress",
      options: validationOptions,
      propertyName,
      target: object.constructor,
      validator: {
        validate(value: any) {
          return typeof value === "string" && EthAddressRegex.test(value);
        },
      },
    });
  };
}