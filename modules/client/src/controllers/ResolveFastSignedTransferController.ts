import { ResolveFastSignedTransferParameters } from "@connext/types";

import { validate, invalid32ByteHexString } from "../validation";

import { AbstractController } from "./AbstractController";

export class ResolveFastSignedTransferController extends AbstractController {
  public resolveFastSignedTransfer = async ({
    paymentId,
    preImage,
  }: ResolveFastSignedTransferParameters) => {
    validate(invalid32ByteHexString(paymentId), invalid32ByteHexString(preImage));
    
  };
}
