import { registerDecorator, ValidationOptions } from "class-validator";

import { XpubRegex } from "../constants";

// tslint:disable-next-line:function-name
export function IsXpub(validationOptions?: ValidationOptions): Function {
  return function(object: Object, propertyName: string): void {
    registerDecorator({
      name: "isXpub",
      options: validationOptions,
      propertyName,
      target: object.constructor,
      validator: {
        validate(value: any): boolean {
          return typeof value === "string" && XpubRegex.test(value);
        },
      },
    });
  };
}

export function isXpub(xpub: string): boolean {
  return XpubRegex.test(xpub);
}

export function assertXpub(xpub: string): void {
  if (!isXpub(xpub)) {
    throw new Error(`${xpub} is not a valid xpub`);
  }
}