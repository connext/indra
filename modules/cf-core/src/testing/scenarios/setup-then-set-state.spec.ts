import { toBN } from "@connext/utils";

import { Contract, Wallet, providers, utils, constants } from "ethers";

import { SetStateCommitment, getSetupCommitment } from "../../ethereum";
import { FreeBalanceClass, StateChannel } from "../../models";
import { Context } from "../../types";
import { getCreate2MultisigAddress } from "../../utils";

import { toBeEq } from "../bignumber-jest-matcher";
import {
  ChallengeRegistry,
  MinimumViableMultisig,
  NetworkContextForTestSuite,
  ProxyFactory,
} from "../contracts";
import { getRandomChannelSigners } from "../random-signing-keys";

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
  let provider: providers.JsonRpcProvider;
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

  it("should distribute funds in ETH free balance when put on chain", async (done) => {
    const [initiator, responder] = getRandomChannelSigners(2);

    const proxyFactory = new Contract(network.ProxyFactory, ProxyFactory.abi, wallet);

    proxyFactory.once("ProxyCreation", async (proxy) => {
      // TODO: Test this separately
      expect(proxy).toBe(
        await getCreate2MultisigAddress(
          initiator.address,
          responder.address,
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
        initiator.publicIdentifier,
        responder.publicIdentifier,
        1,
      ).setFreeBalance(
        FreeBalanceClass.createWithFundedTokenAmounts(
          [initiator, responder].map<string>((key) => key.address),
          constants.WeiPerEther,
          [constants.AddressZero],
        ),
      );

      const freeBalance = stateChannel.freeBalance;

      const setStateCommitment = new SetStateCommitment(
        network.ChallengeRegistry,
        freeBalance.identity,
        utils.keccak256(freeBalance.encodedLatestState),
        toBN(freeBalance.versionNumber),
        toBN(freeBalance.stateTimeout),
      );
      const setStateCommitmentHash = setStateCommitment.hashToSign();
      setStateCommitment.signatures = [
        await initiator.signMessage(setStateCommitmentHash),
        await responder.signMessage(setStateCommitmentHash),
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
        await initiator.signMessage(setupCommitmentHash),
        await responder.signMessage(setupCommitmentHash),
      ];

      const setupTx = await setupCommitment.getSignedTransaction();

      await wallet.sendTransaction({ to: proxy, value: constants.WeiPerEther.mul(2) });

      await wallet.sendTransaction({
        ...setupTx,
        gasLimit: SETUP_COMMITMENT_GAS,
      });

      expect(await provider.getBalance(proxy)).toBeEq(constants.Zero);

      expect(await provider.getBalance(initiator.address)).toBeEq(constants.WeiPerEther);

      expect(await provider.getBalance(responder.address)).toBeEq(constants.WeiPerEther);

      done();
    });

    const iface = new utils.Interface(MinimumViableMultisig.abi);

    await proxyFactory.functions.createProxyWithNonce(
      network.MinimumViableMultisig,
      iface.encodeFunctionData("setup", [[initiator, responder].map((x) => x.address)]),
      0,
      { gasLimit: CREATE_PROXY_AND_SETUP_GAS },
    );
  });
});
