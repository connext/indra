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
import { constants, utils } from "ethers";

import { CFCore } from "../../cfCore";

import { toBeEq } from "../bignumber-jest-matcher";
import { TestContractAddresses } from "../contracts";
import { setup, SetupContext } from "../setup";
import {
  assertMessage,
  collateralizeChannel,
  constructUninstallRpc,
  createChannel,
  getFreeBalanceState,
  getInstalledAppInstances,
  installApp,
  getAppInstance,
} from "../utils";
import { AppInstance } from "../../models";
import { getRandomBytes32 } from "@connext/utils";

const { One, Two, Zero, HashZero } = constants;
const { soliditySha256 } = utils;

expect.extend({ toBeEq });

const { SimpleLinkedTransferApp } = global["contracts"] as TestContractAddresses;

function assertUninstallMessage(
  senderId: string,
  multisigAddress: string,
  appIdentityHash: string,
  uninstalledApp: AppInstanceJson,
  action: AppAction,
  msg: ProtocolEventMessage<"UNINSTALL_EVENT">,
) {
  assertMessage<typeof EventNames.UNINSTALL_EVENT>(msg, {
    from: senderId,
    type: EventNames.UNINSTALL_EVENT,
    data: {
      appIdentityHash,
      multisigAddress,
      uninstalledApp,
      action,
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
    provider = nodeA.networkContext.provider;

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

  it("should take action + uninstall SimpleLinkedTransferApp app", async (done) => {
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
      .setState(await appPreUninstall.computeStateTransition(action, provider), Zero)
      .toJson();

    await Promise.all([
      new Promise(async (resolve, reject) => {
        nodeB.on(EventNames.UNINSTALL_EVENT, async (msg) => {
          if (msg.data.appIdentityHash !== appIdentityHash) {
            return;
          }
          try {
            assertUninstallMessage(
              nodeA.publicIdentifier,
              multisigAddress,
              appIdentityHash,
              expected,
              action,
              msg,
            );

            const balancesSeenByB = await getFreeBalanceState(nodeB, multisigAddress);
            expect(balancesSeenByB[nodeA.signerAddress]).toBeEq(Zero);
            expect(balancesSeenByB[nodeB.signerAddress]).toBeEq(Two);
            expect(await getInstalledAppInstances(nodeB, multisigAddress)).toEqual([]);
            resolve();
          } catch (e) {
            reject(e);
          }
        });
      }),
      new Promise(async (resolve, reject) => {
        try {
          await nodeA.rpcRouter.dispatch(
            constructUninstallRpc(appIdentityHash, multisigAddress, action),
          );

          const balancesSeenByA = await getFreeBalanceState(nodeA, multisigAddress);
          expect(balancesSeenByA[nodeA.signerAddress]).toBeEq(Zero);
          expect(balancesSeenByA[nodeB.signerAddress]).toBeEq(Two);

          expect(await getInstalledAppInstances(nodeA, multisigAddress)).toEqual([]);
          resolve();
        } catch (e) {
          reject(e);
        }
      }),
    ]);

    done();
  }, 30_000);
});
