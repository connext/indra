import { MethodNames, MethodParams, MethodResults } from "@connext/types";
import { delay, getSignerAddressFromPublicIdentifier, stringify } from "@connext/utils";
import { Contract, Signer, utils, constants, providers, BigNumber } from "ethers";

import {
  CHANNEL_CREATION_FAILED,
  NO_TRANSACTION_HASH_FOR_MULTISIG_DEPLOYMENT,
  INCORRECT_MULTISIG_ADDRESS,
  INVALID_FACTORY_ADDRESS,
  INVALID_MASTERCOPY_ADDRESS,
  NO_STATE_CHANNEL_FOR_MULTISIG_ADDR,
  NO_NETWORK_PROVIDER_FOR_CHAIN_ID,
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

let memoryNonce = 0;

export class DeployStateDepositController extends MethodController {
  public readonly methodName = MethodNames.chan_deployStateDepositHolder;
  private inProgress: { [multisig: string]: boolean } = {};

  public executeMethod = super.executeMethod;

  protected async beforeExecution(
    requestHandler: RequestHandler,
    params: MethodParams.DeployStateDepositHolder,
    preProtocolStateChannel: StateChannel,
  ): Promise<MethodResults.DeployStateDepositHolder | undefined> {
    const { networkContexts } = requestHandler;
    const { multisigAddress } = params;

    if (!preProtocolStateChannel) {
      throw new Error(NO_STATE_CHANNEL_FOR_MULTISIG_ADDR(multisigAddress));
    }

    if (!preProtocolStateChannel.addresses.ProxyFactory) {
      throw new Error(INVALID_FACTORY_ADDRESS(preProtocolStateChannel.addresses.ProxyFactory));
    }

    if (!preProtocolStateChannel.addresses.MinimumViableMultisig) {
      throw new Error(
        INVALID_MASTERCOPY_ADDRESS(preProtocolStateChannel.addresses.MinimumViableMultisig),
      );
    }

    const networkContext = networkContexts[preProtocolStateChannel.chainId];

    if (!networkContext?.provider) {
      throw new Error(NO_NETWORK_PROVIDER_FOR_CHAIN_ID(preProtocolStateChannel.chainId));
    }

    const expectedMultisigAddress = await getCreate2MultisigAddress(
      preProtocolStateChannel.userIdentifiers[0],
      preProtocolStateChannel.userIdentifiers[1],
      preProtocolStateChannel.addresses,
      networkContext.provider,
    );

    if (expectedMultisigAddress !== preProtocolStateChannel.multisigAddress) {
      throw new Error(INCORRECT_MULTISIG_ADDRESS);
    }
    return undefined;
  }

  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
    params: MethodParams.DeployStateDepositHolder,
    preProtocolStateChannel: StateChannel,
  ): Promise<MethodResults.DeployStateDepositHolder> {
    const multisigAddress = params.multisigAddress;
    const retryCount = params.retryCount || 1;
    const { networkContexts, signer } = requestHandler;
    const log = requestHandler.log.newContext("CF-DeployStateDepositHolder");
    const networkContext = networkContexts[preProtocolStateChannel.chainId];

    // No need to re-assert what we already asserted in beforeExecution

    if (!signer.provider || !Signer.isSigner(signer)) {
      throw new Error(`Signer must be connected to provider`);
    }
    const provider = networkContext.provider!;
    await signer.connectProvider(provider);

    // If this is called twice concurrently, the second attempt should wait until the first is done
    if (this.inProgress[multisigAddress]) {
      log.warn(`Another deployment is in progress`);
      await new Promise(async (res) => {
        while (true) {
          if (
            !this.inProgress[multisigAddress] ||
            (await provider.getCode(multisigAddress)) !== "0x"
          ) {
            log.info(`Other deployment completed`);
            return res();
          } else {
            await delay(2_000);
          }
        }
      });
    }

    let error: any;
    let result = { transactionHash: HashZero };

    // Check if the contract has already been deployed on-chain
    if ((await provider.getCode(multisigAddress)) === `0x`) {
      this.inProgress[multisigAddress] = true;
      for (let tryCount = 1; tryCount <= retryCount; tryCount += 1) {
        try {
          const chainNonce = await provider.getTransactionCount(await signer.getAddress());
          const nonce = chainNonce > memoryNonce ? chainNonce : memoryNonce;
          log.debug(`chainNonce ${chainNonce} vs memoryNonce ${memoryNonce}`);
          memoryNonce = nonce;
          const proxyFactory = new Contract(
            preProtocolStateChannel.addresses.ProxyFactory,
            ProxyFactory.abi,
            signer,
          );
          log.error(
            `Sending multisig deploy tx onto chain ${preProtocolStateChannel.chainId} using provider ${provider.connection.url}`,
          );
          const tx: providers.TransactionResponse = await proxyFactory.createProxyWithNonce(
            networkContext.contractAddresses.MinimumViableMultisig,
            new Interface(MinimumViableMultisig.abi).encodeFunctionData("setup", [
              preProtocolStateChannel.multisigOwners,
            ]),
            // hash chainId plus nonce for x-chain replay protection
            solidityKeccak256(["uint256", "uint256"], [preProtocolStateChannel.chainId, 0]),
            {
              gasLimit: CREATE_PROXY_AND_SETUP_GAS,
              // FIXME: xDai special case
              gasPrice:
                preProtocolStateChannel.chainId === 100
                  ? BigNumber.from(5)
                  : await provider.getGasPrice(),
              nonce,
            },
          );
          memoryNonce = nonce + 1;

          if (!tx.hash) {
            throw new Error(`${NO_TRANSACTION_HASH_FOR_MULTISIG_DEPLOYMENT}: ${stringify(tx)}`);
          }
          log.info(`Sent multisig deployment tx, waiting for tx hash: ${tx.hash}`);
          await tx.wait();
          log.info(`Done waiting for tx hash: ${tx.hash}`);

          const multisig = new Contract(
            preProtocolStateChannel.multisigAddress,
            MinimumViableMultisig.abi,
            provider,
          );
          const expectedOwners = [
            getSignerAddressFromPublicIdentifier(preProtocolStateChannel.userIdentifiers[0]),
            getSignerAddressFromPublicIdentifier(preProtocolStateChannel.userIdentifiers[1]),
          ];
          const actualOwners = await multisig.getOwners();

          if (!(expectedOwners[0] === actualOwners[0] && expectedOwners[1] === actualOwners[1])) {
            // wait on a linear backoff interval before retrying
            await delay(1000 * tryCount);
            throw new Error(
              `${CHANNEL_CREATION_FAILED}: Could not confirm, on the ${tryCount} try, that the deployed multisig has the expected owners`,
            );
          }

          log.info(`Multisig deployment complete for ${preProtocolStateChannel.multisigAddress}`);
          result = { transactionHash: tx.hash! };
          break;
        } catch (e) {
          const message = e?.body?.error?.message || e.message;
          log.warn(message);
          if (message.includes("the tx doesn't have the correct nonce")) {
            log.warn(`Nonce conflict, trying again real quick: ${message}`);
            tryCount -= 1; // Nonce conflicts don't count as retrys bc no gas spent
            memoryNonce = parseInt(message.match(/account has nonce of: (\d+)/)[1], 10);
            continue;
          }
          if (message.includes("Invalid nonce")) {
            log.warn(`Nonce conflict, trying again real quick: ${message}`);
            tryCount -= 1; // Nonce conflicts don't count as retrys bc no gas spent
            memoryNonce = parseInt(message.match(/Expected (\d+)/)[1], 10);
            continue;
          }
          error = e;
          log.error(`Deployment attempt ${tryCount} failed: ${message}`);
          log.warn(`Retrying ${retryCount - tryCount} more times`);
        }
      }
    }

    this.inProgress[multisigAddress] = false;
    if (error) {
      throw new Error(`${CHANNEL_CREATION_FAILED}: ${stringify(error)}`);
    }
    return result;
  }
}
