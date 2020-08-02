import { ProtocolParams } from "@connext/types";
import { validateSignedTransferApp } from "../SimpleSignedTransferApp";

export const validateGraphBatchedTransferApp = (params: ProtocolParams.Propose) =>
  validateSignedTransferApp(params);
