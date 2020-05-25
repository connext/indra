import { CFCore } from "../../cfCore";

import { TestContractAddresses } from "../contracts";
import { setup, SetupContext } from "../setup";
import { confirmAppInstanceInstallation, createChannel, getAppInstance, installApp } from "../utils";

const { TicTacToeApp } = global["contracts"] as TestContractAddresses;

describe("Node method follows spec - getAppInstance", () => {
  let nodeA: CFCore;
  let nodeB: CFCore;

  beforeAll(async () => {
    const context: SetupContext = await setup(global);
    nodeA = context["A"].node;
    nodeB = context["B"].node;
  });

  it("can accept a valid call to get the desired AppInstance details", async () => {
    const multisigAddress = await createChannel(nodeA, nodeB);

    const [appIdentityHash, proposedParams] = await installApp(
      nodeA,
      nodeB,
      multisigAddress,
      TicTacToeApp,
    );

    const appInstanceNodeA = await getAppInstance(nodeA, appIdentityHash);
    confirmAppInstanceInstallation(proposedParams, appInstanceNodeA);

    const appInstanceNodeB = await getAppInstance(nodeB, appIdentityHash);
    confirmAppInstanceInstallation(proposedParams, appInstanceNodeB);
  });
});
