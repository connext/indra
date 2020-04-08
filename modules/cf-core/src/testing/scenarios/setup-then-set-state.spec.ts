import { signChannelMessage } from "@connext/crypto";
import { Contract, Wallet } from "ethers";
import { WeiPerEther, Zero } from "ethers/constants";
import { JsonRpcProvider } from "ethers/providers";
import { Interface, keccak256, SigningKey } from "ethers/utils";

import { CONVENTION_FOR_ETH_TOKEN_ADDRESS } from "../../constants";
import { SetStateCommitment, getSetupCommitment } from "../../ethereum";
import { FreeBalanceClass, StateChannel } from "../../models";
import { Context } from "../../types";
import { getCreate2MultisigAddress } from "../../utils";
import { xkeyKthHDNode } from "../../xkeys";

import { toBeEq } from "../bignumber-jest-matcher";
import {
  ChallengeRegistry,
  MinimumViableMultisig,
  NetworkContextForTestSuite,
  ProxyFactory,
} from "../contracts";
import { extendedPrvKeyToExtendedPubKey, getRandomExtendedPrvKeys } from "../random-signing-keys";

expect.extend({ toBeEq });
jest.setTimeout(10000);

// ProxyFactory.createProxy uses assembly `call` so we can't estimate
// gas needed, so we hard-code this number to ensure the tx completes
const CREATE_PROXY_AND_SETUP_GAS = 6e9;

// Similarly, the SetupCommitment is a `delegatecall`, so we estimate
const SETUP_COMMITMENT_GAS = 6e9;

// The ChallengeRegistry.setState call _could_ be estimated but we haven't
// written this test to do that yet
const SETSTATE_COMMITMENT_GAS = 6e9;

/**
 * @summary Setup a StateChannel then set state on ETH Free Balance
 */
describe.skip("Scenario: Setup, set state on free balance, go on chain", () => {
  let context: Context;
  let provider: JsonRpcProvider;
  let wallet: Wallet;
  let network: NetworkContextForTestSuite;
  let appRegistry: Contract;

  beforeAll(async () => {
    wallet = global["wallet"];
    network = global["network"];
    provider = network.provider;
    context = { network: global["network"] } as Context;
    appRegistry = new Contract(network.ChallengeRegistry, ChallengeRegistry.abi, wallet);
  });

  it("should distribute funds in ETH free balance when put on chain", async done => {
    const xprvs = getRandomExtendedPrvKeys(2);

    const multisigOwnerKeys = [
      new SigningKey(xkeyKthHDNode(xprvs[0], 0).privateKey),
      new SigningKey(xkeyKthHDNode(xprvs[1], 0).privateKey),
    ];

    const proxyFactory = new Contract(network.ProxyFactory, ProxyFactory.abi, wallet);

    proxyFactory.once("ProxyCreation", async proxy => {
      // TODO: Test this separately
      expect(proxy).toBe(
        await getCreate2MultisigAddress(
          xprvs[0],
          xprvs[1],
          {
            proxyFactory: network.ProxyFactory,
            multisigMastercopy: network.MinimumViableMultisig,
          },
          provider,
        ),
      );

      const stateChannel = StateChannel.setupChannel(
        network.IdentityApp,
        { proxyFactory: network.ProxyFactory, multisigMastercopy: network.MinimumViableMultisig },
        proxy, // used as multisig
        extendedPrvKeyToExtendedPubKey(xprvs[0]),
        extendedPrvKeyToExtendedPubKey(xprvs[1]),
        1,
      ).setFreeBalance(
        FreeBalanceClass.createWithFundedTokenAmounts(
          multisigOwnerKeys.map<string>(key => key.address),
          WeiPerEther,
          [CONVENTION_FOR_ETH_TOKEN_ADDRESS],
        ),
      );

      const freeBalance = stateChannel.freeBalance;

      const setStateCommitment = new SetStateCommitment(
        network.ChallengeRegistry,
        freeBalance.identity,
        keccak256(freeBalance.encodedLatestState),
        freeBalance.versionNumber,
        freeBalance.stateTimeout,
      );
      const setStateCommitmentHash = setStateCommitment.hashToSign();
      setStateCommitment.signatures = [
        await signChannelMessage(multisigOwnerKeys[0].privateKey, setStateCommitmentHash),
        await signChannelMessage(multisigOwnerKeys[1].privateKey, setStateCommitmentHash),
      ];

      const setStateTx = await setStateCommitment.getSignedTransaction();

      await wallet.sendTransaction({
        ...setStateTx,
        gasLimit: SETSTATE_COMMITMENT_GAS,
      });

      // eslint-disable-next-line
      for (const _ of Array(freeBalance.stateTimeout)) {
        await provider.send("evm_mine", []);
      }

      await appRegistry.functions.setOutcome(freeBalance.identity, freeBalance.encodedLatestState);

      const setupCommitment = getSetupCommitment(context, stateChannel);
      const setupCommitmentHash = setupCommitment.hashToSign();

      setupCommitment.signatures = [
        await signChannelMessage(multisigOwnerKeys[0].privateKey, setupCommitmentHash),
        await signChannelMessage(multisigOwnerKeys[1].privateKey, setupCommitmentHash),
      ];

      const setupTx = await setupCommitment.getSignedTransaction();

      await wallet.sendTransaction({ to: proxy, value: WeiPerEther.mul(2) });

      await wallet.sendTransaction({
        ...setupTx,
        gasLimit: SETUP_COMMITMENT_GAS,
      });

      expect(await provider.getBalance(proxy)).toBeEq(Zero);

      expect(await provider.getBalance(multisigOwnerKeys[0].address)).toBeEq(WeiPerEther);

      expect(await provider.getBalance(multisigOwnerKeys[1].address)).toBeEq(WeiPerEther);

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
