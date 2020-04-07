import { One } from "ethers/constants";
import { JsonRpcProvider } from "ethers/providers";
import { BigNumber } from "ethers/utils";

import { Node } from "../../node";
import { generatePrivateKeyGeneratorAndXPubPair } from "../../private-keys-generator";
import { CONVENTION_FOR_ETH_TOKEN_ADDRESS } from "../../constants";
import { ProposeMessage } from "../../types";

import { toBeLt } from "../bignumber-jest-matcher";
import { NetworkContextForTestSuite } from "../contracts";
import {
  MemoryLockService,
  MemoryMessagingService,
  MemoryStoreServiceFactory,
} from "../services";
import { A_EXTENDED_PRIVATE_KEY, B_EXTENDED_PRIVATE_KEY } from "../test-constants.jest";
import {
  collateralizeChannel,
  createChannel,
  getBalances,
  getInstalledAppInstances,
  makeInstallCall,
  makeProposeCall,
  newWallet,
} from "../utils";

expect.extend({ toBeLt });

describe(`Uses a provided signing key generation function to sign channel state updates`, () => {
  let multisigAddress: string;
  jest.setTimeout(10000);
  let nodeA: Node;
  let nodeB: Node;

  describe(
    `Node A gets app install proposal, sends to node B, B approves it, installs it, ` +
      `sends acks back to A, A installs it, both nodes have the same app instance`,
    () => {
      beforeEach(async () => {
        const wallet = newWallet(global["wallet"]);
        const provider = wallet.provider as JsonRpcProvider;
        const messagingService = new MemoryMessagingService();
        const nodeConfig = { STORE_KEY_PREFIX: `test` };

        const lockService = new MemoryLockService();

        const storeServiceA = new MemoryStoreServiceFactory().createStoreService();
        const [privateKeyGeneratorA, xpubA] = generatePrivateKeyGeneratorAndXPubPair(
          A_EXTENDED_PRIVATE_KEY,
        );
        nodeA = await Node.create(
          messagingService,
          storeServiceA,
          global[`network`],
          nodeConfig,
          provider,
          lockService,
          xpubA,
          privateKeyGeneratorA,
        );

        const storeServiceB = new MemoryStoreServiceFactory().createStoreService();
        const [privateKeyGeneratorB, xpubB] = generatePrivateKeyGeneratorAndXPubPair(
          B_EXTENDED_PRIVATE_KEY,
        );
        nodeB = await Node.create(
          messagingService,
          storeServiceB,
          global[`network`],
          nodeConfig,
          provider,
          lockService,
          xpubB,
          privateKeyGeneratorB,
        );

        multisigAddress = await createChannel(nodeA, nodeB);
      });

      it(`install app with ETH`, async done => {
        await collateralizeChannel(multisigAddress, nodeA, nodeB);

        let preInstallETHBalanceNodeA: BigNumber;
        let postInstallETHBalanceNodeA: BigNumber;
        let preInstallETHBalanceNodeB: BigNumber;
        let postInstallETHBalanceNodeB: BigNumber;

        nodeB.on(`PROPOSE_INSTALL_EVENT`, async (msg: ProposeMessage) => {
          [preInstallETHBalanceNodeA, preInstallETHBalanceNodeB] = await getBalances(
            nodeA,
            nodeB,
            multisigAddress,
            CONVENTION_FOR_ETH_TOKEN_ADDRESS,
          );
          makeInstallCall(nodeB, msg.data.appIdentityHash);
        });

        nodeA.on(`INSTALL_EVENT`, async () => {
          const [appInstanceNodeA] = await getInstalledAppInstances(nodeA, multisigAddress);
          const [appInstanceNodeB] = await getInstalledAppInstances(nodeB, multisigAddress);
          expect(appInstanceNodeA).toBeDefined();
          expect(appInstanceNodeA).toEqual(appInstanceNodeB);

          [postInstallETHBalanceNodeA, postInstallETHBalanceNodeB] = await getBalances(
            nodeA,
            nodeB,
            multisigAddress,
            CONVENTION_FOR_ETH_TOKEN_ADDRESS,
          );

          expect(postInstallETHBalanceNodeA).toBeLt(preInstallETHBalanceNodeA);

          expect(postInstallETHBalanceNodeB).toBeLt(preInstallETHBalanceNodeB);

          done();
        });

        nodeA.rpcRouter.dispatch(
          await makeProposeCall(
            nodeB,
            (global[`network`] as NetworkContextForTestSuite).TicTacToeApp,
            multisigAddress,
            undefined,
            One,
            CONVENTION_FOR_ETH_TOKEN_ADDRESS,
            One,
            CONVENTION_FOR_ETH_TOKEN_ADDRESS,
          ),
        );
      });
    },
  );
});
