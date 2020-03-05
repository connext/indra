import { ResolveFastSignedTransferParameters } from "@connext/types";

import { validate, invalid32ByteHexString, invalidEthSignature } from "../validation";
import { AbstractController } from "./AbstractController";

export class ResolveFastSignedTransferController extends AbstractController {
  public resolveFastSignedTransfer = async ({
    data,
    signature,
  }: ResolveFastSignedTransferParameters) => {
    validate(invalid32ByteHexString(data), invalidEthSignature(signature));
  };
}
