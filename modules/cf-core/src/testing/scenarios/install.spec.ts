import {
  CONVENTION_FOR_ETH_ASSET_ID,
  InstallMessage,
  ProposeMessage,
  ProtocolParams,
} from "@connext/types";
import { delay, getAddressFromAssetId } from "@connext/utils";
import { One } from "ethers/constants";
import { BigNumber, isHexString } from "ethers/utils";

import { CFCore } from "../../cfCore";
import { NULL_INITIAL_STATE_FOR_PROPOSAL } from "../../errors";

import { TestContractAddresses } from "../contracts";
import { toBeLt, toBeEq } from "../bignumber-jest-matcher";

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
} from "../utils";

expect.extend({ toBeLt, toBeEq });

const { TicTacToeApp } = global["contracts"] as TestContractAddresses;

describe("Node method follows spec - install", () => {
  let multisigAddress: string;
  let nodeA: CFCore;
  let nodeB: CFCore;

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

      it("install app with ETH", async (done) => {
        await collateralizeChannel(multisigAddress, nodeA, nodeB);
        const appDeposit = One;

        let preInstallETHBalanceNodeA: BigNumber;
        let postInstallETHBalanceNodeA: BigNumber;
        let preInstallETHBalanceNodeB: BigNumber;
        let postInstallETHBalanceNodeB: BigNumber;

        let proposeInstallParams: ProtocolParams.Propose;

        nodeB.on("PROPOSE_INSTALL_EVENT", async (msg: ProposeMessage) => {
          // Delay because propose event fires before params are set
          await delay(1500);
          [preInstallETHBalanceNodeA, preInstallETHBalanceNodeB] = await getBalances(
            nodeA,
            nodeB,
            multisigAddress,
            CONVENTION_FOR_ETH_ASSET_ID,
          );
          assertProposeMessage(nodeA.publicIdentifier, msg, proposeInstallParams);
          await makeInstallCall(nodeB, msg.data.appIdentityHash, multisigAddress);
        });

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
            CONVENTION_FOR_ETH_ASSET_ID,
          );

          expect(postInstallETHBalanceNodeA).toBeEq(preInstallETHBalanceNodeA.sub(appDeposit));

          expect(postInstallETHBalanceNodeB).toBeEq(preInstallETHBalanceNodeB.sub(appDeposit));

          // assert install message
          assertInstallMessage(nodeB.publicIdentifier, msg, appInstanceNodeA.identityHash);

          done();
        });
        const { params } = await makeAndSendProposeCall(
          nodeA,
          nodeB,
          TicTacToeApp,
          multisigAddress,
          undefined,
          appDeposit,
          CONVENTION_FOR_ETH_ASSET_ID,
          appDeposit,
          CONVENTION_FOR_ETH_ASSET_ID,
        );
        proposeInstallParams = params;
      });

      it("install app with ERC20", async (done) => {
        await transferERC20Tokens(await nodeA.signerAddress);
        await transferERC20Tokens(await nodeB.signerAddress);

        const erc20TokenAddress = (global["contracts"] as TestContractAddresses).DolphinCoin;
        const assetId = getAddressFromAssetId(erc20TokenAddress);

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
          makeInstallCall(nodeB, msg.data.appIdentityHash, multisigAddress);
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
