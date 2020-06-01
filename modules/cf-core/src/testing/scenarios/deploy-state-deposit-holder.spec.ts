import { providers, constants } from "ethers";

import { CFCore } from "../../cfCore";

import { toBeEq } from "../bignumber-jest-matcher";
import { setup, SetupContext } from "../setup";
import { createChannel, deployStateDepositHolder, deposit } from "../utils";

const { HashZero, One } = constants;

expect.extend({ toBeEq });

describe("Node method follows spec - deploy state deposit holder", () => {
  let nodeA: CFCore;
  let nodeB: CFCore;
  let provider: providers.JsonRpcProvider;
  let multisigAddress: string;

  beforeEach(async () => {
    const context: SetupContext = await setup(global, true, true);
    provider = global["wallet"].provider;
    nodeA = context["A"].node;
    nodeB = context["B"].node;
    multisigAddress = await createChannel(nodeA, nodeB);
    expect(multisigAddress).toBeDefined();
  });

  it("deploys the multisig when the method is called", async () => {
    const deployTxHash = await deployStateDepositHolder(nodeA, multisigAddress);

    expect(deployTxHash).toBeDefined();
    expect(deployTxHash !== HashZero).toBeTruthy();
  });

  it("can deposit when multisig has not been deployed", async () => {
    const startingMultisigBalance = await provider.getBalance(multisigAddress);
    await deposit(nodeA, multisigAddress, One, nodeB);

    const postDepositMultisigBalance = await provider.getBalance(multisigAddress);

    expect(postDepositMultisigBalance).toBeEq(startingMultisigBalance.add(One));
  });
});
