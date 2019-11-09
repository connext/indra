export {
  CreateChannelMessage,
  DepositConfirmationMessage,
  EXTENDED_PRIVATE_KEY_PATH,
  InstallMessage,
  InstallVirtualMessage,
  JsonRpcResponse,
  Node as CFCore,
  ProposeMessage,
  RejectInstallVirtualMessage,
  UninstallMessage,
  UninstallVirtualMessage,
  UpdateStateMessage,
  WithdrawMessage,
} from "@connext/cf-core";
// } from "@counterfactual/node";

// Uncomment the desired source:
// - @connext/cf-core is better for local dev bc you can add logs galore w/out wrestling w lerna
// - @counterfactual/node might be better for prod once it stabilizes
