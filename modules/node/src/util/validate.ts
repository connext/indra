import { registerDecorator, ValidationOptions } from "class-validator";
import { arrayify, isHexString } from "ethers/utils";

export const isValidHex = (hex: string, bytes: number): boolean =>
  isHexString(hex) && arrayify(hex).length === bytes;

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

export const isKeccak256Hash = (address: string): boolean => isValidHex(address, 32);

export function IsKeccak256Hash(validationOptions?: ValidationOptions): Function {
  return function(object: Object, propertyName: string): void {
    registerDecorator({
      name: "isKeccak256Hash",
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
