import {
  isAddress,
  isBytes32,
  isEthAddress,
  isEthSignature,
  isKeccak256Hash,
  isValidHex,
  isValidPublicIdentifier,
} from "@connext/utils";
import { registerDecorator, ValidationOptions } from "class-validator";

export function IsValidHex(validationOptions?: ValidationOptions): Function {
  return function(object: Object, propertyName: string): void {
    registerDecorator({
      name: "isValidHex",
      options: validationOptions,
      propertyName,
      target: object.constructor,
      validator: {
        validate(value: any): boolean {
          return isValidHex(value);
        },
      },
    });
  };
}

export function IsEthAddress(validationOptions?: ValidationOptions): Function {
  return function(object: Object, propertyName: string): void {
    registerDecorator({
      name: "isEthAddress",
      options: validationOptions,
      propertyName,
      target: object.constructor,
      validator: {
        validate(value: any): boolean {
          return isEthAddress(value);
        },
      },
    });
  };
}

export function IsKeccak256Hash(validationOptions?: ValidationOptions): Function {
  return function(object: Object, propertyName: string): void {
    registerDecorator({
      name: "isKeccak256Hash",
      options: validationOptions,
      propertyName,
      target: object.constructor,
      validator: {
        validate(value: any): boolean {
          return isKeccak256Hash(value);
        },
      },
    });
  };
}

export function IsEthSignature(validationOptions?: ValidationOptions): Function {
  return function(object: Object, propertyName: string): void {
    registerDecorator({
      name: "isEthSignature",
      options: validationOptions,
      propertyName,
      target: object.constructor,
      validator: {
        validate(value: any): boolean {
          return isEthSignature(value);
        },
      },
    });
  };
}

export function IsBytes32(validationOptions?: ValidationOptions): Function {
  return function(object: Object, propertyName: string): void {
    registerDecorator({
      name: "isBytes32",
      options: validationOptions,
      propertyName,
      target: object.constructor,
      validator: {
        validate(value: any): boolean {
          return isBytes32(value);
        },
      },
    });
  };
}

export function IsAddress(validationOptions?: ValidationOptions): Function {
  return function(object: Object, propertyName: string): void {
    registerDecorator({
      name: "isAddress",
      options: validationOptions,
      propertyName,
      target: object.constructor,
      validator: {
        validate(value: any): boolean {
          return isAddress(value);
        },
      },
    });
  };
}

export function IsValidPublicIdentifier(validationOptions?: ValidationOptions): Function {
  return function(object: Object, propertyName: string): void {
    registerDecorator({
      name: "isValidPublicIdentifier",
      options: validationOptions,
      propertyName,
      target: object.constructor,
      validator: {
        validate(value: any): boolean {
          return isValidPublicIdentifier(value);
        },
      },
    });
  };
}
