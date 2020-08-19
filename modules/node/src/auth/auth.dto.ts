import { VerifyNonceDtoType } from "@connext/types";

export class VerifyNonceDto implements VerifyNonceDtoType {
  sig!: string;
  userIdentifier!: string;
  adminToken?: string;
}
