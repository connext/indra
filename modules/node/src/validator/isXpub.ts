import { registerDecorator, ValidationOptions } from "class-validator";

import { XpubRegex } from "../constants";

// tslint:disable-next-line:function-name
export function IsXpub(validationOptions?: ValidationOptions) {
  return function(object: Object, propertyName: string) {
    registerDecorator({
      name: "isXpub",
      options: validationOptions,
      propertyName,
      target: object.constructor,
      validator: {
        validate(value: any) {
          return typeof value === "string" && XpubRegex.test(value);
        },
      },
    });
  };
}