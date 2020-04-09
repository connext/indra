import {
  delay,
  InstallMessage,
  ProposeMessage,
  ProtocolParams,
  getAssetId,
} from "@connext/types";
import { One } from "ethers/constants";
import { BigNumber, isHexString } from "ethers/utils";

import { Node } from "../../node";
import { NULL_INITIAL_STATE_FOR_PROPOSAL } from "../../errors";

import { NetworkContextForTestSuite } from "../contracts";
import { toBeLt } from "../bignumber-jest-matcher";

import { setup, SetupContext } from "../setup";
import {
  assertInstallMessage,
  assertProposeMessage,
  collateralizeChannel,
  constructAppProposalRpc,
  createChannel,
  getAppContext,
  getBalances,
  getInstalledAppInstances,
  getProposedAppInstances,
  makeAndSendProposeCall,
  makeInstallCall,
  transferERC20Tokens,
  CONVENTION_FOR_ETH_ASSET_ID_GANACHE,
  GANACHE_CHAIN_ID,
} from "../utils";

expect.extend({ toBeLt });

const { TicTacToeApp } = global["network"] as NetworkContextForTestSuite;

describe("Node method follows spec - install", () => {
  let multisigAddress: string;
  let nodeA: Node;
  let nodeB: Node;

  describe(
    "Node A gets app install proposal, sends to node B, B approves it, installs it, " +
      "sends acks back to A, A installs it, both nodes have the same app instance",
    () => {
      beforeEach(async () => {
        const context: SetupContext = await setup(global);
        nodeA = context["A"].node;
        nodeB = context["B"].node;

        multisigAddress = await createChannel(nodeA, nodeB);
        expect(multisigAddress).toBeDefined();
        expect(isHexString(multisigAddress)).toBeTruthy();
      });

      it("install app with ETH", async done => {
        await collateralizeChannel(multisigAddress, nodeA, nodeB);

        let preInstallETHBalanceNodeA: BigNumber;
        let postInstallETHBalanceNodeA: BigNumber;
        let preInstallETHBalanceNodeB: BigNumber;
        let postInstallETHBalanceNodeB: BigNumber;

        let proposeInstallParams: ProtocolParams.Propose;

        nodeB.on("PROPOSE_INSTALL_EVENT", async (msg: ProposeMessage) => {
          // Delay because propose event fires before params are set
          await delay(2000);
          [preInstallETHBalanceNodeA, preInstallETHBalanceNodeB] = await getBalances(
            nodeA,
            nodeB,
            multisigAddress,
            CONVENTION_FOR_ETH_ASSET_ID_GANACHE,
          );
          assertProposeMessage(nodeA.publicIdentifier, msg, proposeInstallParams);
          makeInstallCall(nodeB, msg.data.appIdentityHash);
        });

        // FIXME: still no symmetric events -- nodeB will never emit an
        // `INSTALL` event
        // let installEvents = 0;
        // nodeB.once("INSTALL_EVENT", async () => {
        //   const proposedAppsB = await getProposedAppInstances(nodeB);
        //   expect(proposedAppsB.length).toEqual(0);
        //   installEvents += 1;
        //   if (installEvents === 2) {
        //     done();
        //   }
        // });

        nodeA.on("INSTALL_EVENT", async (msg: InstallMessage) => {
          const [appInstanceNodeA] = await getInstalledAppInstances(nodeA, multisigAddress);
          const [appInstanceNodeB] = await getInstalledAppInstances(nodeB, multisigAddress);
          expect(appInstanceNodeA).toBeDefined();
          expect(appInstanceNodeA).toEqual(appInstanceNodeB);

          const proposedAppsA = await getProposedAppInstances(nodeA, multisigAddress);
          expect(proposedAppsA.length).toBe(0);

          [postInstallETHBalanceNodeA, postInstallETHBalanceNodeB] = await getBalances(
            nodeA,
            nodeB,
            multisigAddress,
            CONVENTION_FOR_ETH_ASSET_ID_GANACHE,
          );

          expect(postInstallETHBalanceNodeA).toBeLt(preInstallETHBalanceNodeA);

          expect(postInstallETHBalanceNodeB).toBeLt(preInstallETHBalanceNodeB);

          // assert install message
          assertInstallMessage(nodeB.publicIdentifier, msg, appInstanceNodeA.identityHash);

          done();

          // FIXME: add the below when there are symmetric events
          // installEvents += 1;
          // if (installEvents === 2) {
          //   done();
          // }
        });
        const { params } = await makeAndSendProposeCall(
          nodeA,
          nodeB,
          TicTacToeApp,
          multisigAddress,
          undefined,
          One,
          CONVENTION_FOR_ETH_ASSET_ID_GANACHE,
          One,
          CONVENTION_FOR_ETH_ASSET_ID_GANACHE,
        );
        proposeInstallParams = params;
      });

      it("install app with ERC20", async done => {
        await transferERC20Tokens(await nodeA.signerAddress);
        await transferERC20Tokens(await nodeB.signerAddress);

        const erc20TokenAddress = (global["network"] as NetworkContextForTestSuite).DolphinCoin;
        const assetId = getAssetId(GANACHE_CHAIN_ID, erc20TokenAddress);

        await collateralizeChannel(multisigAddress, nodeA, nodeB, One, assetId);

        let preInstallERC20BalanceNodeA: BigNumber;
        let postInstallERC20BalanceNodeA: BigNumber;
        let preInstallERC20BalanceNodeB: BigNumber;
        let postInstallERC20BalanceNodeB: BigNumber;

        let proposedParams: ProtocolParams.Propose;

        nodeB.on("PROPOSE_INSTALL_EVENT", async (msg: ProposeMessage) => {
          // Delay because propose event fires before params are set
          await delay(2000);
          [preInstallERC20BalanceNodeA, preInstallERC20BalanceNodeB] = await getBalances(
            nodeA,
            nodeB,
            multisigAddress,
            assetId,
          );
          assertProposeMessage(nodeA.publicIdentifier, msg, proposedParams);
          makeInstallCall(nodeB, msg.data.appIdentityHash);
        });

        nodeA.on("INSTALL_EVENT", async (msg: InstallMessage) => {
          const [appInstanceNodeA] = await getInstalledAppInstances(nodeA, multisigAddress);
          const [appInstanceNodeB] = await getInstalledAppInstances(nodeB, multisigAddress);
          expect(appInstanceNodeA).toEqual(appInstanceNodeB);

          [postInstallERC20BalanceNodeA, postInstallERC20BalanceNodeB] = await getBalances(
            nodeA,
            nodeB,
            multisigAddress,
            assetId,
          );

          expect(postInstallERC20BalanceNodeA).toBeLt(preInstallERC20BalanceNodeA);

          expect(postInstallERC20BalanceNodeB).toBeLt(preInstallERC20BalanceNodeB);

          assertInstallMessage(nodeB.publicIdentifier, msg, appInstanceNodeA.identityHash);

          done();
        });

        const { params } = await makeAndSendProposeCall(
          nodeA,
          nodeB,
          TicTacToeApp,
          multisigAddress,
          undefined,
          One,
          assetId,
          One,
          assetId,
        );
        proposedParams = params;
      });

      it("sends proposal with null initial state", async () => {
        const appContext = getAppContext(TicTacToeApp);
        const appInstanceProposalReq = constructAppProposalRpc(
          multisigAddress,
          nodeB.publicIdentifier,
          appContext.appDefinition,
          appContext.abiEncodings,
          appContext.initialState,
        );

        appInstanceProposalReq.parameters["initialState"] = undefined;

        await expect(nodeA.rpcRouter.dispatch(appInstanceProposalReq)).rejects.toThrowError(
          NULL_INITIAL_STATE_FOR_PROPOSAL,
        );
      });
    },
  );
});
