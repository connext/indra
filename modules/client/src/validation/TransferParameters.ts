import { convert } from "@connext/types";
import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from "class-validator";
import { constants, utils } from "ethers";

function isAddress(address: string): boolean {
  try {
    utils.getAddress(address);
  } catch (e) {
    return false;
  }
  return true;
}

function isBigNumberIsh(value: utils.BigNumberish): boolean {
  try {
    utils.bigNumberify(value);
  } catch (e) {
    return false;
  }
  return true;
}

function isValidOrBurn(value: string): boolean {
  return isAddress(value) || value === constants.AddressZero;
}

@ValidatorConstraint({ name: "isValidTransferRequest" })
export class IsValidTransferRequestConstraint implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments): boolean {
    console.log(`Validating value: ${JSON.stringify(value, null, 2)}`);
    // validate the keys are correct
    const { amount, recipient, assetId } = value;
    if (!amount || !recipient) {
      return false;
    }
    // asset id should be the token address or the
    // burn address
    if (assetId && !isValidOrBurn(value.assetId)) {
      return false;
    }

    // recipient should be the xpub of the payee
    if (typeof recipient !== "string" || !recipient.startsWith("xpub")) {
      return false;
    }

    // cannot be converted to a big number, or
    // is not already a bignumber
    if (!isBigNumberIsh(amount)) {
      return false;
    }

    // transfer amounts should be above 0
    const amountBig = utils.bigNumberify(amount);
    if (amountBig.lte(constants.Zero)) {
      return false;
    }

    console.log("Found valid value");
    return true;
  }

  // TODO: why isnt this working???
  defaultMessage(args: ValidationArguments): string {
    return `Invalid transfer arguments given. Args: ${JSON.stringify(
      convert.Transfer("str", args.value),
      null,
      2,
    )}`;
  }
}

export function IsValidTransferRequest(validationOptions?: ValidationOptions): Function {
  return function(object: Object, propertyName: string): void {
    registerDecorator({
      constraints: [],
      options: validationOptions,
      propertyName,
      target: object.constructor,
      validator: IsValidTransferRequestConstraint,
    });
  };
}
