import { ProtocolName, ProtocolNames, ProtocolExecutionFlow } from "../types";

import { INSTALL_PROTOCOL } from "./install";
import { PROPOSE_PROTOCOL } from "./propose";
import { SETUP_PROTOCOL } from "./setup";
import { TAKE_ACTION_PROTOCOL } from "./take-action";
import { UNINSTALL_PROTOCOL } from "./uninstall";
import { UPDATE_PROTOCOL } from "./update";

const protocolsByName = {
<<<<<<< HEAD
  [ProtocolNames.install]: INSTALL_PROTOCOL,
  [ProtocolNames.propose]: PROPOSE_PROTOCOL,
  [ProtocolNames.setup]: SETUP_PROTOCOL,
  [ProtocolNames.takeAction]: TAKE_ACTION_PROTOCOL,
  [ProtocolNames.uninstall]: UNINSTALL_PROTOCOL,
  [ProtocolNames.update]: UPDATE_PROTOCOL,
  [ProtocolNames.withdraw]: WITHDRAW_PROTOCOL,
=======
  [Protocol.Install]: INSTALL_PROTOCOL,
  [Protocol.Propose]: PROPOSE_PROTOCOL,
  [Protocol.Setup]: SETUP_PROTOCOL,
  [Protocol.TakeAction]: TAKE_ACTION_PROTOCOL,
  [Protocol.Uninstall]: UNINSTALL_PROTOCOL,
  [Protocol.Update]: UPDATE_PROTOCOL,
>>>>>>> 845-store-refactor
};

export function getProtocolFromName(protocolName: ProtocolName): ProtocolExecutionFlow {
  if (!(protocolName in protocolsByName)) {
    throw Error(`Received invalid protocol type ${protocolName}`);
  }
  return protocolsByName[protocolName];
}
