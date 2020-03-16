import { ProtocolName, ProtocolNames, ProtocolExecutionFlow } from "../types";

import { INSTALL_PROTOCOL } from "./install";
import { PROPOSE_PROTOCOL } from "./propose";
import { SETUP_PROTOCOL } from "./setup";
import { TAKE_ACTION_PROTOCOL } from "./take-action";
import { UNINSTALL_PROTOCOL } from "./uninstall";
import { UPDATE_PROTOCOL } from "./update";
import { WITHDRAW_PROTOCOL } from "./withdraw";

const protocolsByName = {
  [ProtocolNames.install]: INSTALL_PROTOCOL,
  [ProtocolNames.propose]: PROPOSE_PROTOCOL,
  [ProtocolNames.setup]: SETUP_PROTOCOL,
  [ProtocolNames.takeAction]: TAKE_ACTION_PROTOCOL,
  [ProtocolNames.uninstall]: UNINSTALL_PROTOCOL,
  [ProtocolNames.update]: UPDATE_PROTOCOL,
  [ProtocolNames.withdraw]: WITHDRAW_PROTOCOL,
};

export function getProtocolFromName(protocolName: ProtocolName): ProtocolExecutionFlow {
  if (!(protocolName in protocolsByName)) {
    throw Error(`Received invalid protocol type ${protocolName}`);
  }
  return protocolsByName[protocolName];
}
