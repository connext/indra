import { ChallengeRegistry, MinimumViableMultisig, ProxyFactory } from "@connext/contracts";
import { toBN } from "@connext/utils";
import { Contract, Wallet, providers, constants, utils } from "ethers";

import { SetStateCommitment, getSetupCommitment } from "../../ethereum";
import { FreeBalanceClass, StateChannel } from "../../models";
import { Context } from "../../types";
import { getCreate2MultisigAddress } from "../../utils";

import { toBeEq } from "../bignumber-jest-matcher";
import { TestContractAddresses } from "../contracts";
import { getRandomChannelSigners } from "../random-signing-keys";

const { WeiPerEther, Zero, AddressZero } = constants;
const { Interface, keccak256 } = utils;

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
  let contracts: TestContractAddresses;
  let appRegistry: Contract;

  beforeAll(async () => {
    wallet = global["wallet"];
    contracts = global["contracts"];
    provider = wallet.provider as providers.JsonRpcProvider;
    context = { network: { contractAddresses: global["contracts"] } } as Context;
    appRegistry = new Contract(contracts.ChallengeRegistry, ChallengeRegistry.abi, wallet);
  });

  it("should distribute funds in ETH free balance when put on chain", async (done) => {
    const [initiator, responder] = getRandomChannelSigners(2);

    const proxyFactory = new Contract(contracts.ProxyFactory, ProxyFactory.abi, wallet);

    proxyFactory.once("ProxyCreation", async (proxy) => {
      // TODO: Test this separately
      expect(proxy).toBe(
        await getCreate2MultisigAddress(initiator.address, responder.address, contracts, provider),
      );

      const stateChannel = StateChannel.setupChannel(
        contracts.IdentityApp,
        contracts,
        proxy, // used as multisig
        initiator.publicIdentifier,
        responder.publicIdentifier,
        1,
      ).setFreeBalance(
        FreeBalanceClass.createWithFundedTokenAmounts(
          [initiator, responder].map<string>((key) => key.address),
          WeiPerEther,
          [AddressZero],
        ),
      );

      const freeBalance = stateChannel.freeBalance;

      const setStateCommitment = new SetStateCommitment(
        contracts.ChallengeRegistry,
        freeBalance.identity,
        keccak256(freeBalance.encodedLatestState),
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

      await appRegistry.setOutcome(freeBalance.identity, freeBalance.encodedLatestState);

      const setupCommitment = getSetupCommitment(context, stateChannel);
      const setupCommitmentHash = setupCommitment.hashToSign();

      setupCommitment.signatures = [
        await initiator.signMessage(setupCommitmentHash),
        await responder.signMessage(setupCommitmentHash),
      ];

      const setupTx = await setupCommitment.getSignedTransaction();

      await wallet.sendTransaction({ to: proxy, value: WeiPerEther.mul(2) });

      await wallet.sendTransaction({
        ...setupTx,
        gasLimit: SETUP_COMMITMENT_GAS,
      });

      expect(await provider.getBalance(proxy)).toBeEq(Zero);

      expect(await provider.getBalance(initiator.address)).toBeEq(WeiPerEther);

      expect(await provider.getBalance(responder.address)).toBeEq(WeiPerEther);

      done();
    });

    await proxyFactory.createProxyWithNonce(
      contracts.MinimumViableMultisig,
      new Interface(MinimumViableMultisig.abi).encodeFunctionData("setup", [
        [initiator, responder].map((x) => x.address),
      ]),
      0,
      { gasLimit: CREATE_PROXY_AND_SETUP_GAS },
    );
  });
});
