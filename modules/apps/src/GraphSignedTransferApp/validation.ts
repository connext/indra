import { ProtocolParams } from "@connext/types";
import { validateSignedTransferApp } from "../SimpleSignedTransferApp";

export const validateGraphSignedTransferApp = (params: ProtocolParams.Propose) =>
  validateSignedTransferApp(params);
