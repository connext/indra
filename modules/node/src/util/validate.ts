import { registerDecorator, ValidationOptions } from "class-validator";
import { arrayify, isHexString } from "ethers/utils";

export const isValidHex = (hex: string, bytes?: number): boolean =>
  isHexString(hex) && (bytes ? arrayify(hex).length === bytes : true);

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

export const isEthAddress = (address: string): boolean => isValidHex(address, 20);

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

export const isEthSignature = (signature: string): boolean => isValidHex(signature, 65);

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

export const isBytes32 = (address: string): boolean => isValidHex(address, 32);

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

export const isXpub = (xpub: string): boolean => /^xpub[a-zA-Z0-9]{107}$/.test(xpub);

export function IsXpub(validationOptions?: ValidationOptions): Function {
  return function(object: Object, propertyName: string): void {
    registerDecorator({
      name: "isXpub",
      options: validationOptions,
      propertyName,
      target: object.constructor,
      validator: {
        validate(value: any): boolean {
          return isXpub(value);
        },
      },
    });
  };
}
