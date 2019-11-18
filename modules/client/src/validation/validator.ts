import { falsy } from "./";

export function validator(errs: string[]): string[] {
  return errs.filter(falsy);
}

/**
 * Function to validate or throw an error. Conditions are defined in the `validation/` folder.
 *
 * @param conditions Validation conditions defined within the validation folder
 */
export function validate(...conditions: any): void {
  const invalid = validator(conditions);
  if (invalid.length > 0) {
    throw new Error(invalid.join(", "));
  }
}
