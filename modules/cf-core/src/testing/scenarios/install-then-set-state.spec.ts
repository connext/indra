import {
  MultiAssetMultiPartyCoinTransferInterpreterParams,
  OutcomeType,
} from "@connext/types";
import { signDigest } from "@connext/crypto";
import { Contract, Wallet } from "ethers";
import { WeiPerEther, Zero } from "ethers/constants";
import { JsonRpcProvider } from "ethers/providers";
import { Interface, parseEther } from "ethers/utils";

import { CONVENTION_FOR_ETH_TOKEN_ADDRESS } from "../../constants";
import {
  getConditionalTransactionCommitment,
  getSetupCommitment,
  getSetStateCommitment,
} from "../../ethereum";
import { AppInstance, FreeBalanceClass, StateChannel } from "../../models";
import { Context } from "../../types";
import { xkeysToSortedKthSigningKeys } from "../../xkeys";

import {
  ChallengeRegistry,
  DolphinCoin,
  MinimumViableMultisig,
  NetworkContextForTestSuite,
  ProxyFactory,
} from "../contracts";
import { transferERC20Tokens, newWallet } from "../utils";

import { toBeEq } from "../bignumber-jest-matcher";
import { extendedPrvKeyToExtendedPubKey, getRandomExtendedPrvKeys } from "../random-signing-keys";

expect.extend({ toBeEq });

// ProxyFactory.createProxy uses assembly `call` so we can't estimate
// gas needed, so we hard-code this number to ensure the tx completes
const CREATE_PROXY_AND_SETUP_GAS = 1e6;

// The ChallengeRegistry.setState call _could_ be estimated but we haven't
// written this test to do that yet
const SETSTATE_COMMITMENT_GAS = 1e6;

// Also we can't estimate the install commitment gas b/c it uses
// delegatecall for the conditional transaction
const CONDITIONAL_TX_DELEGATECALL_GAS = 1e6;

/**
 * @summary Set up a StateChannel and then install a new AppInstance into it.
 *
 * @description We re-use the FreeBalanceApp App (which is the app ETH Free Balance uses)
 * as the test app being installed. We then set the values to [1, 1] in that app
 * and trigger the InstallCommitment on-chain to resolve that app and verify
 * the balances have been updated on-chain.
 */
describe("Scenario: install AppInstance, set state, put on-chain", () => {
  let context: Context;
  let wallet: Wallet;
  let network: NetworkContextForTestSuite;
  let appRegistry: Contract;

  beforeAll(() => {
    jest.setTimeout(20000);
    network = global["network"];
    wallet = newWallet(global["wallet"]);
    context = { network: global["network"] } as Context;
    appRegistry = new Contract(network.ChallengeRegistry, ChallengeRegistry.abi, wallet);
  });

  it("returns the funds the app had locked up for both ETH and ERC20 in app and free balance", async done => {
    const xprvs = getRandomExtendedPrvKeys(2);
    const multisigOwnerKeys = xkeysToSortedKthSigningKeys(xprvs, 0);
    const xpubs = xprvs.map(extendedPrvKeyToExtendedPubKey);
    const erc20TokenAddress = network.DolphinCoin;
    const proxyFactory = new Contract(network.ProxyFactory, ProxyFactory.abi, wallet);

    proxyFactory.once("ProxyCreation", async (proxyAddress: string) => {
      let stateChannel = StateChannel.setupChannel(
        network.IdentityApp,
        { proxyFactory: proxyFactory.address, multisigMastercopy: network.MinimumViableMultisig },
        proxyAddress, // used as multisigAddress
        xpubs,
        1,
      ).setFreeBalance(
        FreeBalanceClass.createWithFundedTokenAmounts(
          multisigOwnerKeys.map(key => key.address),
          WeiPerEther,
          [CONVENTION_FOR_ETH_TOKEN_ADDRESS, erc20TokenAddress],
        ),
      );

      const uniqueAppSigningKeys = xkeysToSortedKthSigningKeys(xprvs, stateChannel.numProposedApps);

      // todo(xuanji): don't reuse state
      // todo(xuanji): use createAppInstance
      const identityAppInstance = new AppInstance(
        uniqueAppSigningKeys.map(x => x.address),
        stateChannel.freeBalance.defaultTimeout, // Re-use ETH FreeBalance timeout
        {
          addr: network.IdentityApp,
          stateEncoding: "tuple(address to, uint256 amount)[][]",
          actionEncoding: undefined,
        },
        stateChannel.numProposedApps,
        [
          // ETH token index
          [
            { to: multisigOwnerKeys[0].address, amount: WeiPerEther },
            { to: multisigOwnerKeys[1].address, amount: Zero },
          ],
          // ERC20 token index
          [
            { to: multisigOwnerKeys[0].address, amount: Zero },
            { to: multisigOwnerKeys[1].address, amount: WeiPerEther },
          ],
        ],
        1,
        stateChannel.freeBalance.timeout, // Re-use ETH FreeBalance timeout
        OutcomeType.MULTI_ASSET_MULTI_PARTY_COIN_TRANSFER,
        stateChannel.multisigAddress,
        undefined,
        undefined,
        {
          // total limit of ETH and ERC20 token that can be transferred
          limit: [WeiPerEther, WeiPerEther],
          // The only assets being transferred are ETH and the ERC20 token
          tokenAddresses: [CONVENTION_FOR_ETH_TOKEN_ADDRESS, erc20TokenAddress],
        } as MultiAssetMultiPartyCoinTransferInterpreterParams,
        undefined,
      );

      stateChannel = stateChannel.installApp(identityAppInstance, {
        [CONVENTION_FOR_ETH_TOKEN_ADDRESS]: {
          [multisigOwnerKeys[0].address]: WeiPerEther,
          [multisigOwnerKeys[1].address]: Zero,
        },
        [erc20TokenAddress]: {
          [multisigOwnerKeys[0].address]: Zero,
          [multisigOwnerKeys[1].address]: WeiPerEther,
        },
      });

      const setStateCommitment = getSetStateCommitment(
        context,
        identityAppInstance,
      );

      const setStateCommitmentHash = setStateCommitment.hashToSign();

      setStateCommitment.signatures = [
        await signDigest(uniqueAppSigningKeys[0].privateKey, setStateCommitmentHash),
        await signDigest(uniqueAppSigningKeys[1].privateKey, setStateCommitmentHash),
      ];

      await wallet.sendTransaction({
        ...(await setStateCommitment.getSignedTransaction()),
        gasLimit: SETSTATE_COMMITMENT_GAS,
      });

      const setStateCommitmentForFreeBalance = getSetStateCommitment(
        context,
        stateChannel.freeBalance,
      );
      const setStateCommitmentForFreeBalanceHash = setStateCommitmentForFreeBalance.hashToSign();
      setStateCommitmentForFreeBalance.signatures = [
        await signDigest(multisigOwnerKeys[0].privateKey, setStateCommitmentForFreeBalanceHash),
        await signDigest(multisigOwnerKeys[1].privateKey, setStateCommitmentForFreeBalanceHash),
      ];

      await wallet.sendTransaction({
        ...(await setStateCommitmentForFreeBalance.getSignedTransaction()),
        gasLimit: SETSTATE_COMMITMENT_GAS,
      });

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for (const _ of Array(identityAppInstance.timeout)) {
        await (wallet.provider as JsonRpcProvider).send("evm_mine", []);
      }

      await appRegistry.functions.setOutcome(
        identityAppInstance.identity,
        identityAppInstance.encodedLatestState,
      );

      await appRegistry.functions.setOutcome(
        stateChannel.freeBalance.identity,
        stateChannel.freeBalance.encodedLatestState,
      );

      const conditionalTransaction = getConditionalTransactionCommitment(
        context,
        stateChannel,
        identityAppInstance,
      );
      const conditionalTransactionHash = conditionalTransaction.hashToSign();
      conditionalTransaction.signatures = [
        await signDigest(multisigOwnerKeys[0].privateKey, conditionalTransactionHash),
        await signDigest(multisigOwnerKeys[1].privateKey, conditionalTransactionHash),
      ];
      const multisigDelegateCallTx = await conditionalTransaction.getSignedTransaction();

      await wallet.sendTransaction({
        to: proxyAddress,
        value: parseEther("2"),
      });

      await transferERC20Tokens(proxyAddress, erc20TokenAddress, DolphinCoin.abi, parseEther("2"));

      await wallet.sendTransaction({
        ...multisigDelegateCallTx,
        gasLimit: CONDITIONAL_TX_DELEGATECALL_GAS,
      });

      expect(await wallet.provider.getBalance(proxyAddress)).toBeEq(WeiPerEther);
      expect(await wallet.provider.getBalance(multisigOwnerKeys[0].address)).toBeEq(WeiPerEther);
      expect(await wallet.provider.getBalance(multisigOwnerKeys[1].address)).toBeEq(Zero);

      const erc20Contract = new Contract(
        erc20TokenAddress,
        DolphinCoin.abi,
        wallet.provider,
      );

      expect(await erc20Contract.functions.balanceOf(proxyAddress)).toBeEq(WeiPerEther);
      expect(await erc20Contract.functions.balanceOf(multisigOwnerKeys[0].address)).toBeEq(Zero);
      expect(await erc20Contract.functions.balanceOf(multisigOwnerKeys[1].address)).toBeEq(
        WeiPerEther,
      );

      const freeBalanceConditionalTransaction = getSetupCommitment(context, stateChannel);

      freeBalanceConditionalTransaction.signatures = [
        await signDigest(
          multisigOwnerKeys[0].privateKey,
          freeBalanceConditionalTransaction.hashToSign(),
        ),
        await signDigest(
          multisigOwnerKeys[1].privateKey,
          freeBalanceConditionalTransaction.hashToSign(),
        ),
      ];

      const multisigDelegateCallTx2 =
        await freeBalanceConditionalTransaction.getSignedTransaction();

      await wallet.sendTransaction({
        ...multisigDelegateCallTx2,
        gasLimit: CONDITIONAL_TX_DELEGATECALL_GAS,
      });

      expect(await wallet.provider.getBalance(proxyAddress)).toBeEq(Zero);
      expect(await wallet.provider.getBalance(multisigOwnerKeys[0].address)).toBeEq(WeiPerEther);
      expect(await wallet.provider.getBalance(multisigOwnerKeys[1].address)).toBeEq(WeiPerEther);

      expect(await erc20Contract.functions.balanceOf(proxyAddress)).toBeEq(Zero);
      expect(await erc20Contract.functions.balanceOf(multisigOwnerKeys[0].address)).toBeEq(
        WeiPerEther,
      );
      expect(await erc20Contract.functions.balanceOf(multisigOwnerKeys[1].address)).toBeEq(
        WeiPerEther,
      );

      done();
    });

    await proxyFactory.functions.createProxyWithNonce(
      network.MinimumViableMultisig,
      new Interface(MinimumViableMultisig.abi).functions.setup.encode([
        multisigOwnerKeys.map(x => x.address),
      ]),
      0,
      { gasLimit: CREATE_PROXY_AND_SETUP_GAS },
    );
  });
});
