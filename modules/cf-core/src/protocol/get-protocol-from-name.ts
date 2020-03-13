import { Protocol } from "../machine";
import { ProtocolExecutionFlow } from "../types";

import { INSTALL_PROTOCOL } from "./install";
import { PROPOSE_PROTOCOL } from "./propose";
import { SETUP_PROTOCOL } from "./setup";
import { TAKE_ACTION_PROTOCOL } from "./take-action";
import { UNINSTALL_PROTOCOL } from "./uninstall";
import { UPDATE_PROTOCOL } from "./update";
import { WITHDRAW_PROTOCOL } from "./withdraw";

const protocolsByName = {
  [Protocol.Install]: INSTALL_PROTOCOL,
  [Protocol.Propose]: PROPOSE_PROTOCOL,
  [Protocol.Setup]: SETUP_PROTOCOL,
  [Protocol.TakeAction]: TAKE_ACTION_PROTOCOL,
  [Protocol.Uninstall]: UNINSTALL_PROTOCOL,
  [Protocol.Update]: UPDATE_PROTOCOL,
  [Protocol.Withdraw]: WITHDRAW_PROTOCOL,
};

export function getProtocolFromName(protocolName: Protocol): ProtocolExecutionFlow {
  if (!(protocolName in protocolsByName)) {
    throw Error(`Received invalid protocol type ${protocolName}`);
  }
  return protocolsByName[protocolName];
}
