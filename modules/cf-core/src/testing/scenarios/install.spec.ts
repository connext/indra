import {
  CONVENTION_FOR_ETH_ASSET_ID,
  ProtocolParams,
  ProtocolEventMessage,
  IStoreService,
} from "@connext/types";
import { delay, getAddressFromAssetId } from "@connext/utils";
import { BigNumber, constants, utils } from "ethers";

import { expect } from "../assertions";
import { CFCore } from "../../cfCore";
import { NULL_INITIAL_STATE_FOR_PROPOSAL } from "../../errors";
import { TestContractAddresses } from "../contracts";
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

const { One } = constants;
const { isHexString } = utils;

describe("Node method follows spec - install", () => {
  let multisigAddress: string;
  let nodeA: CFCore;
  let nodeB: CFCore;
  let storeA: IStoreService;

  describe(
    "Node A gets app install proposal, sends to node B, B approves it, installs it, " +
      "sends acks back to A, A installs it, both nodes have the same app instance",
    () => {
      beforeEach(async () => {
        const context: SetupContext = await setup(global);
        nodeA = context["A"].node;
        nodeB = context["B"].node;
        storeA = context["A"].store;

        multisigAddress = await createChannel(nodeA, nodeB);
        expect(multisigAddress).to.be.ok;
        expect(isHexString(multisigAddress)).to.be.ok;
      });

      it("install app with ETH", async () => {
        return new Promise(async (done) => {
          const { TicTacToeApp } = global["contracts"] as TestContractAddresses;

          await collateralizeChannel(multisigAddress, nodeA, nodeB);
          const appDeposit = One;

          let preInstallETHBalanceNodeA: BigNumber;
          let postInstallETHBalanceNodeA: BigNumber;
          let preInstallETHBalanceNodeB: BigNumber;
          let postInstallETHBalanceNodeB: BigNumber;

          let proposeInstallParams: ProtocolParams.Propose;

          nodeB.on(
            "PROPOSE_INSTALL_EVENT",
            async (msg: ProtocolEventMessage<"PROPOSE_INSTALL_EVENT">) => {
              // Delay because propose event fires before params are set
              await delay(1500);
              [preInstallETHBalanceNodeA, preInstallETHBalanceNodeB] = await getBalances(
                nodeA,
                nodeB,
                multisigAddress,
                CONVENTION_FOR_ETH_ASSET_ID,
              );
              assertProposeMessage(nodeA.publicIdentifier, msg, proposeInstallParams);
              await makeInstallCall(nodeB, msg.data.appInstanceId, multisigAddress);
            },
          );

          nodeA.on("INSTALL_EVENT", async (msg: ProtocolEventMessage<"INSTALL_EVENT">) => {
            const [appInstanceNodeA] = await getInstalledAppInstances(nodeA, multisigAddress);
            const [appInstanceNodeB] = await getInstalledAppInstances(nodeB, multisigAddress);
            expect(appInstanceNodeA).to.be.ok;
            expect(appInstanceNodeA).to.deep.eq(appInstanceNodeB);

            const proposedAppsA = await getProposedAppInstances(nodeA, multisigAddress);
            expect(proposedAppsA.length).to.eq(0);

            [postInstallETHBalanceNodeA, postInstallETHBalanceNodeB] = await getBalances(
              nodeA,
              nodeB,
              multisigAddress,
              CONVENTION_FOR_ETH_ASSET_ID,
            );

            expect(postInstallETHBalanceNodeA).to.eq(preInstallETHBalanceNodeA.sub(appDeposit));

            expect(postInstallETHBalanceNodeB).to.eq(preInstallETHBalanceNodeB.sub(appDeposit));

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
      });

      it("install app with ERC20", async () => {
        const { TicTacToeApp } = global["contracts"] as TestContractAddresses;

        await transferERC20Tokens(nodeA.signerAddress);
        await transferERC20Tokens(nodeB.signerAddress);

        const erc20TokenAddress = (global["contracts"] as TestContractAddresses).DolphinCoin;
        const assetId = getAddressFromAssetId(erc20TokenAddress);

        await collateralizeChannel(multisigAddress, nodeA, nodeB, One, assetId);

        let preInstallERC20BalanceNodeA: BigNumber;
        let postInstallERC20BalanceNodeA: BigNumber;
        let preInstallERC20BalanceNodeB: BigNumber;
        let postInstallERC20BalanceNodeB: BigNumber;

        let proposedParams: ProtocolParams.Propose;

        nodeB.on("PROPOSE_INSTALL_EVENT", async (msg) => {
          // Delay because propose event fires before params are set
          await delay(2000);
          [preInstallERC20BalanceNodeA, preInstallERC20BalanceNodeB] = await getBalances(
            nodeA,
            nodeB,
            multisigAddress,
            assetId,
          );
          assertProposeMessage(nodeA.publicIdentifier, msg, proposedParams);
          makeInstallCall(nodeB, msg.data.appInstanceId, multisigAddress);
        });

        nodeA.on("INSTALL_EVENT", async (msg) => {
          const [appInstanceNodeA] = await getInstalledAppInstances(nodeA, multisigAddress);
          const [appInstanceNodeB] = await getInstalledAppInstances(nodeB, multisigAddress);
          expect(appInstanceNodeA).to.deep.eq(appInstanceNodeB);

          [postInstallERC20BalanceNodeA, postInstallERC20BalanceNodeB] = await getBalances(
            nodeA,
            nodeB,
            multisigAddress,
            assetId,
          );

          expect(postInstallERC20BalanceNodeA).to.be.lt(preInstallERC20BalanceNodeA);

          expect(postInstallERC20BalanceNodeB).to.be.lt(preInstallERC20BalanceNodeB);

          assertInstallMessage(nodeB.publicIdentifier, msg, appInstanceNodeA.identityHash);
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
        const { TicTacToeApp } = global["contracts"] as TestContractAddresses;

        const appContext = getAppContext(TicTacToeApp);
        const AppInstanceJsonReq = constructAppProposalRpc(
          multisigAddress,
          nodeB.publicIdentifier,
          appContext.appDefinition,
          appContext.abiEncodings,
          appContext.initialState,
        );

        AppInstanceJsonReq.parameters["initialState"] = undefined;

        await expect(nodeA.rpcRouter.dispatch(AppInstanceJsonReq)).to.eventually.be.rejectedWith(
          NULL_INITIAL_STATE_FOR_PROPOSAL,
        );
      });

      it("should error on initiating node if there is an error for the responder", async () => {
        return new Promise(async (done) => {
          const { TicTacToeApp } = global["contracts"] as TestContractAddresses;
          await collateralizeChannel(multisigAddress, nodeA, nodeB);
          const appDeposit = One;

          nodeB.on(
            "PROPOSE_INSTALL_EVENT",
            async (msg: ProtocolEventMessage<"PROPOSE_INSTALL_EVENT">) => {
              // Delay because propose event fires before params are set
              await delay(500);
              // Delete the responders channel
              await storeA.removeAppProposal(multisigAddress, msg.data.appInstanceId, {} as any);
              await expect(
                makeInstallCall(nodeB, msg.data.appInstanceId, multisigAddress),
              ).to.eventually.be.rejectedWith(
                `Counterparty execution of install failed: No proposed AppInstance exists for the given appIdentityHash`,
              );
              done();
            },
          );
          await makeAndSendProposeCall(
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
        });
      });
    },
  );
});
