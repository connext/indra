import {
  CONVENTION_FOR_ETH_ASSET_ID,
  EventNames,
  ProtocolEventMessage,
  AppInstanceJson,
  AppAction,
  JsonRpcProvider,
  AppStates,
  SimpleLinkedTransferAppName,
  AppActions,
} from "@connext/types";
import { getRandomBytes32, getSignerAddressFromPublicIdentifier } from "@connext/utils";
import { constants, utils } from "ethers";

import { CFCore } from "../../cfCore";

import { setup, SetupContext } from "../setup";
import {
  assertMessage,
  collateralizeChannel,
  constructUninstallRpc,
  createChannel,
  getAppInstance,
  getContractAddresses,
  getFreeBalanceState,
  getInstalledAppInstances,
  installApp,
} from "../utils";
import { AppInstance } from "../../models";
import { expect } from "../assertions";

const { One, Two, Zero, HashZero } = constants;
const { soliditySha256 } = utils;

function assertUninstallMessage(
  senderId: string,
  multisigAddress: string,
  appIdentityHash: string,
  uninstalledApp: AppInstanceJson,
  action: AppAction,
  msg: ProtocolEventMessage<"UNINSTALL_EVENT">,
  protocolMeta?: any,
) {
  assertMessage<typeof EventNames.UNINSTALL_EVENT>(msg, {
    from: senderId,
    type: EventNames.UNINSTALL_EVENT,
    data: {
      appIdentityHash,
      multisigAddress,
      uninstalledApp,
      action,
      protocolMeta,
    },
  });
}

describe("Node A and B install an app, then uninstall with a given action", () => {
  let nodeA: CFCore;
  let nodeB: CFCore;
  let provider: JsonRpcProvider;

  let appIdentityHash: string;
  let multisigAddress: string;
  const depositAmount = One;

  let initialState: AppStates[typeof SimpleLinkedTransferAppName];
  let action: AppActions[typeof SimpleLinkedTransferAppName];

  beforeEach(async () => {
    const context: SetupContext = await setup(global);
    nodeA = context["A"].node;
    nodeB = context["B"].node;
    provider = (Object.values(global["networks"])[0] as any).provider;

    multisigAddress = await createChannel(nodeA, nodeB);
    await collateralizeChannel(multisigAddress, nodeA, nodeB, depositAmount);

    action = { preImage: getRandomBytes32() };
    initialState = {
      finalized: false,
      linkedHash: soliditySha256(["bytes32"], [action.preImage]),
      preImage: HashZero,
      coinTransfers: [
        { to: nodeA.signerAddress, amount: depositAmount },
        { to: nodeB.signerAddress, amount: Zero },
      ],
    };
  });

  it("should take action + uninstall SimpleLinkedTransferApp app", async () => {
    const { SimpleLinkedTransferApp } = getContractAddresses();
    [appIdentityHash] = await installApp(
      nodeA,
      nodeB,
      multisigAddress,
      SimpleLinkedTransferApp,
      initialState,
      depositAmount,
      CONVENTION_FOR_ETH_ASSET_ID,
      Zero,
      CONVENTION_FOR_ETH_ASSET_ID,
    );
    const appPreUninstall = AppInstance.fromJson(await getAppInstance(nodeA, appIdentityHash));
    const expected = appPreUninstall
      .setState(
        await appPreUninstall.computeStateTransition(
          getSignerAddressFromPublicIdentifier(nodeB.publicIdentifier),
          action,
          provider,
        ),
        Zero,
      )
      .toJson();

    const protocolMeta = { hello: "world" };

    await Promise.all([
      new Promise(async (resolve, reject) => {
        nodeA.on(EventNames.UNINSTALL_EVENT, async (msg) => {
          if (msg.data.appIdentityHash !== appIdentityHash) {
            return;
          }
          try {
            assertUninstallMessage(
              nodeB.publicIdentifier,
              multisigAddress,
              appIdentityHash,
              expected,
              action,
              msg,
              protocolMeta,
            );

            const balancesSeenByB = await getFreeBalanceState(nodeB, multisigAddress);
            expect(balancesSeenByB[nodeA.signerAddress]).to.eq(Zero);
            expect(balancesSeenByB[nodeB.signerAddress]).to.eq(Two);
            expect(await getInstalledAppInstances(nodeB, multisigAddress)).to.deep.eq([]);
            resolve();
          } catch (e) {
            reject(e);
          }
        });
      }),
      new Promise(async (resolve, reject) => {
        try {
          await nodeB.rpcRouter.dispatch(
            constructUninstallRpc(appIdentityHash, multisigAddress, action, protocolMeta),
          );

          const balancesSeenByA = await getFreeBalanceState(nodeA, multisigAddress);
          expect(balancesSeenByA[nodeA.signerAddress]).to.eq(Zero);
          expect(balancesSeenByA[nodeB.signerAddress]).to.eq(Two);

          expect(await getInstalledAppInstances(nodeA, multisigAddress)).to.deep.eq([]);
          resolve();
        } catch (e) {
          reject(e);
        }
      }),
    ]);
  });
});
