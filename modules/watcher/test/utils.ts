import { JsonRpcProvider, AppIdentity } from "@connext/types";
import { ChallengeRegistry, AppWithAction } from "@connext/contracts";
import { createRandomAddress, ChannelSigner, computeAppChallengeHash, stringify } from "@connext/utils";
import { hexlify, randomBytes, keccak256, solidityPack, BigNumber } from "ethers/utils";
import { Wallet, ContractFactory } from "ethers";
import { One } from "ethers/constants";
import { waffleChai } from "@ethereum-waffle/chai";
import { use } from "chai";

/////////////////////////////
//// Assertions

use(require("chai-as-promised"));
use(require("chai-subset"));
use(waffleChai);

export { expect } from "chai";

/////////////////////////////
//// Helper functions

export const randomState = (numBytes: number = 64) => hexlify(randomBytes(numBytes));

export const stateToHash = (state: string) => keccak256(state);


/////////////////////////////
//// Context
export const setupContext = async () => {
  const ethProvider = process.env.ETHPROVIDER_URL;

  // deploy challenge registry + app
  const provider = new JsonRpcProvider(ethProvider);
  const wallet = Wallet.fromMnemonic(process.env.SUGAR_DADDY!).connect(provider);

  const factory = new ContractFactory(
    ChallengeRegistry.abi,
    ChallengeRegistry.bytecode,
    wallet,
  );
  const challengeRegistry = await factory.deploy();
  await challengeRegistry.deployed();

  const appFactory = new ContractFactory(
    AppWithAction.abi,
    AppWithAction.bytecode,
    wallet,
  );
  const onchainApp = await appFactory.deploy();
  await onchainApp.deployed();

  // setup constants
  const channelInitiator = Wallet.createRandom().connect(provider);
  const channelResponder = Wallet.createRandom().connect(provider);
  const multisigAddress = createRandomAddress();

  const appInstance = new AppWithCounterClass(
    [channelInitiator.address, channelResponder.address],
    multisigAddress,
    onchainApp.address,
    One, // default timeout
    One, // channel nonce
  );

  // contract helper functions
  const setState = async (
    versionNumber: BigNumber,
    timeout: BigNumber,
    appState: string,
  ) => {
    const stateHash = keccak256(appState);
    const digest = computeAppChallengeHash(
      appInstance.identityHash,
      stateHash,
      versionNumber,
      timeout,
    );
    const signatures = [
      await new ChannelSigner(channelInitiator.privateKey, ethProvider).signMessage(digest),
      await new ChannelSigner(channelResponder.privateKey, ethProvider).signMessage(digest),
    ];
    const tx = await challengeRegistry.functions.setState(
      appInstance.appIdentity, 
      {
        versionNumber,
        appStateHash: stateHash,
        timeout,
        signatures,
      },
    );
    return tx;
  };

  return {
    ethProvider,
    challengeRegistry,
    provider,
    wallet,
    channelInitiator,
    channelResponder,
    multisigAddress,
    appInstance,
    setState,
  };
};

/////////////////////////////
//// Helper class
export class AppWithCounterClass {
  get identityHash(): string {
    return keccak256(
      solidityPack(
        ["address", "uint256", "bytes32", "address", "uint256"],
        [
          this.multisigAddress,
          this.channelNonce,
          keccak256(solidityPack(["address[]"], [this.participants])),
          this.appDefinition,
          this.defaultTimeout,
        ],
      ),
    );
  }

  get appIdentity(): AppIdentity {
    return {
      participants: this.participants,
      multisigAddress: this.multisigAddress,
      appDefinition: this.appDefinition,
      defaultTimeout: this.defaultTimeout.toString(),
      channelNonce: this.channelNonce.toString(),
    };
  }

  constructor(
    readonly participants: string[],
    readonly multisigAddress: string,
    readonly appDefinition: string,
    readonly defaultTimeout: BigNumber,
    readonly channelNonce: BigNumber,
  ) {}
}