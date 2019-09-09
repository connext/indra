export {
  CreateChannelMessage,
  DepositConfirmationMessage,
  EXTENDED_PRIVATE_KEY_PATH,
  InstallMessage,
  InstallVirtualMessage,
  JsonRpcResponse,
  Node as CFCore,
  ProposeMessage,
  ProposeVirtualMessage,
  RejectInstallVirtualMessage,
  UninstallMessage,
  UninstallVirtualMessage,
  UpdateStateMessage,
  WithdrawMessage,
} from "@counterfactual/node";

// cf-core imports are segregated so that later,
// importing from a local module is an easy option
