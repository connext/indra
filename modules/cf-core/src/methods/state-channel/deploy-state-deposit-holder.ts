import {
  IChannelSigner,
  ILoggerService,
  MethodNames,
  MethodParams,
  MethodResults,
  NetworkContext,
  PublicIdentifier,
} from "@connext/types";
import { delay, getSignerAddressFromPublicIdentifier, stringify } from "@connext/utils";
import { Contract, Signer, utils, constants, providers } from "ethers";

import {
  CHANNEL_CREATION_FAILED,
  NO_TRANSACTION_HASH_FOR_MULTISIG_DEPLOYMENT,
  INCORRECT_MULTISIG_ADDRESS,
  INVALID_FACTORY_ADDRESS,
  INVALID_MASTERCOPY_ADDRESS,
  NO_STATE_CHANNEL_FOR_MULTISIG_ADDR,
} from "../../errors";
import { MinimumViableMultisig, ProxyFactory } from "../../contracts";
import { StateChannel } from "../../models";
import { RequestHandler } from "../../request-handler";
import { getCreate2MultisigAddress } from "../../utils";

import { MethodController } from "../controller";

const { HashZero } = constants;
const { Interface, solidityKeccak256 } = utils;

// Estimate based on rinkeby transaction:
// 0xaac429aac389b6fccc7702c8ad5415248a5add8e8e01a09a42c4ed9733086bec
const CREATE_PROXY_AND_SETUP_GAS = 500_000;

export class DeployStateDepositController extends MethodController {
  public readonly methodName = MethodNames.chan_deployStateDepositHolder;

  public executeMethod = super.executeMethod;

  protected async beforeExecution(
    requestHandler: RequestHandler,
    params: MethodParams.DeployStateDepositHolder,
  ): Promise<void> {
    const { store, networkContext } = requestHandler;
    const { multisigAddress } = params;

    const json = await store.getStateChannel(multisigAddress);
    if (!json) {
      throw new Error(NO_STATE_CHANNEL_FOR_MULTISIG_ADDR(multisigAddress));
    }
    const channel = StateChannel.fromJson(json);

    if (!channel.addresses.ProxyFactory) {
      throw new Error(INVALID_FACTORY_ADDRESS(channel.addresses.ProxyFactory));
    }

    if (!channel.addresses.MinimumViableMultisig) {
      throw new Error(INVALID_MASTERCOPY_ADDRESS(channel.addresses.MinimumViableMultisig));
    }

    const expectedMultisigAddress = await getCreate2MultisigAddress(
      channel.userIdentifiers[0],
      channel.userIdentifiers[1],
      channel.addresses,
      networkContext.provider,
    );

    if (expectedMultisigAddress !== channel.multisigAddress) {
      throw new Error(INCORRECT_MULTISIG_ADDRESS);
    }
  }

  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
    params: MethodParams.DeployStateDepositHolder,
  ): Promise<MethodResults.DeployStateDepositHolder> {
    const { multisigAddress, retryCount } = params;
    const { log, networkContext, store, signer } = requestHandler;

    // By default, if the contract has been deployed and
    // DB has records of it, controller will return HashZero
    let tx = { hash: HashZero } as providers.TransactionResponse;

    const json = await store.getStateChannel(multisigAddress);
    if (!json) {
      throw new Error(NO_STATE_CHANNEL_FOR_MULTISIG_ADDR(multisigAddress));
    }
    const channel = StateChannel.fromJson(json);

    // make sure it is deployed to the right address
    const expectedMultisigAddress = await getCreate2MultisigAddress(
      channel.userIdentifiers[0],
      channel.userIdentifiers[1],
      channel.addresses,
      networkContext.provider,
    );

    if (expectedMultisigAddress !== channel.multisigAddress) {
      throw new Error(INCORRECT_MULTISIG_ADDRESS);
    }

    // Check if the contract has already been deployed on-chain
    if ((await networkContext.provider.getCode(multisigAddress)) === `0x`) {
      tx = await sendMultisigDeployTx(signer, channel, networkContext, retryCount, log);
    }

    return { transactionHash: tx.hash! };
  }
}

async function sendMultisigDeployTx(
  signer: IChannelSigner,
  stateChannel: StateChannel,
  networkContext: NetworkContext,
  retryCount: number = 1,
  log: ILoggerService,
): Promise<providers.TransactionResponse> {
  if (!signer.provider || !Signer.isSigner(signer)) {
    throw new Error(`Signer must be connected to provider`);
  }
  const provider = signer.provider!;

  // make sure that the proxy factory used to deploy is the same as the one
  // used when the channel was created
  const proxyFactory = new Contract(stateChannel.addresses.ProxyFactory, ProxyFactory.abi, signer);

  const owners = stateChannel.userIdentifiers;

  const signerAddress = await signer.getAddress();

  let error;
  for (let tryCount = 1; tryCount < retryCount + 1; tryCount += 1) {
    try {
      const tx: providers.TransactionResponse = await proxyFactory.createProxyWithNonce(
        networkContext.contractAddresses.MinimumViableMultisig,
        new Interface(MinimumViableMultisig.abi).encodeFunctionData("setup", [
          stateChannel.multisigOwners,
        ]),
        // hash chainId plus nonce for x-chain replay protection
        solidityKeccak256(["uint256", "uint256"], [(await provider.getNetwork()).chainId, 0]), // TODO: Increment nonce as needed
        {
          gasLimit: CREATE_PROXY_AND_SETUP_GAS,
          gasPrice: provider.getGasPrice(),
          nonce: provider.getTransactionCount(signerAddress),
        },
      );

      if (!tx.hash) {
        throw new Error(`${NO_TRANSACTION_HASH_FOR_MULTISIG_DEPLOYMENT}: ${stringify(tx)}`);
      }
      log.info(`Sent multisig deployment tx, waiting for tx hash: ${tx.hash}`);
      await tx.wait();
      log.info(`Done waiting for tx hash: ${tx.hash}`);

      const ownersAreCorrectlySet = await checkForCorrectOwners(
        tx!,
        provider as providers.JsonRpcProvider,
        owners,
        stateChannel.multisigAddress,
      );

      if (!ownersAreCorrectlySet) {
        log.error(
          `${CHANNEL_CREATION_FAILED}: Could not confirm, on the ${tryCount} try, that the deployed multisig contract has the expected owners`,
        );
        // wait on a linear backoff interval before retrying
        await delay(1000 * tryCount);
        continue;
      }

      if (tryCount > 1) {
        log.debug(`Deploying multisig failed on first try, but succeeded on try #${tryCount}`);
      }
      log.info(`Multisig deployment complete for ${stateChannel.multisigAddress}`);
      return tx;
    } catch (e) {
      error = e;
      log.error(
        `Channel creation attempt ${tryCount} failed: ${e}.\n Retrying ${
          retryCount - tryCount
        } more times`,
      );
    }
  }

  throw new Error(`${CHANNEL_CREATION_FAILED}: ${stringify(error)}`);
}

async function checkForCorrectOwners(
  tx: providers.TransactionResponse,
  provider: providers.JsonRpcProvider,
  identifiers: PublicIdentifier[], // [initiator, responder]
  multisigAddress: string,
): Promise<boolean> {
  await tx.wait();

  const contract = new Contract(multisigAddress, MinimumViableMultisig.abi, provider);

  const expectedOwners = [
    getSignerAddressFromPublicIdentifier(identifiers[0]),
    getSignerAddressFromPublicIdentifier(identifiers[1]),
  ];

  const actualOwners = await contract.getOwners();

  return expectedOwners[0] === actualOwners[0] && expectedOwners[1] === actualOwners[1];
}
