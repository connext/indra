import {
  MethodNames,
  MethodParams,
  MethodResults,
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

let memoryNonce = 0;

export class DeployStateDepositController extends MethodController {
  public readonly methodName = MethodNames.chan_deployStateDepositHolder;
  private inProgress = false;

  public executeMethod = super.executeMethod;

  protected async beforeExecution(
    requestHandler: RequestHandler,
    params: MethodParams.DeployStateDepositHolder,
  ): Promise<MethodResults.DeployStateDepositHolder | undefined> {
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
    return undefined;
  }

  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
    params: MethodParams.DeployStateDepositHolder,
  ): Promise<MethodResults.DeployStateDepositHolder> {
    const multisigAddress = params.multisigAddress;
    const retryCount = params.retryCount || 1;
    const { networkContext, store, signer } = requestHandler;
    const log = requestHandler.log.newContext("CF-DeployStateDepositHolder");

    // No need to re-assert what we already asserted in beforeExecution
    const channel = StateChannel.fromJson((await store.getStateChannel(multisigAddress))!);

    if (!signer.provider || !Signer.isSigner(signer)) {
      throw new Error(`Signer must be connected to provider`);
    }
    const provider = signer.provider!;

    // If this is called twice concurrently, the second attempt should wait until the first is done
    if (this.inProgress) {
      log.warn(`Another deployment is in progress`);
      await new Promise(async (res) => {
        while (true) {
          if (!this.inProgress || (await provider.getCode(multisigAddress)) !== "0x") {
            log.info(`Other deployment completed`);
            return res();
          } else {
            await delay(2_000);
          }
        }
      });
    }

    let error;
    let result = { transactionHash: HashZero };

    // Check if the contract has already been deployed on-chain
    if ((await provider.getCode(multisigAddress)) === `0x`) {
      this.inProgress = true;
      for (let tryCount = 1; tryCount <= retryCount; tryCount += 1) {
        try {
          const chainNonce = await provider.getTransactionCount(await signer.getAddress());
          const nonce = chainNonce > memoryNonce ? chainNonce : memoryNonce;
          log.debug(`chainNonce ${chainNonce} vs memoryNonce ${memoryNonce}`);
          memoryNonce = nonce;
          const proxyFactory = new Contract(
            channel.addresses.ProxyFactory,
            ProxyFactory.abi,
            signer,
          );
          const tx: providers.TransactionResponse = await proxyFactory.createProxyWithNonce(
            networkContext.contractAddresses.MinimumViableMultisig,
            new Interface(MinimumViableMultisig.abi).encodeFunctionData("setup", [
              channel.multisigOwners,
            ]),
            // hash chainId plus nonce for x-chain replay protection
            solidityKeccak256(["uint256", "uint256"], [(await provider.getNetwork()).chainId, 0]),
            {
              gasLimit: CREATE_PROXY_AND_SETUP_GAS,
              gasPrice: provider.getGasPrice(),
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
            channel.multisigAddress,
            MinimumViableMultisig.abi,
            provider,
          );
          const expectedOwners = [
            getSignerAddressFromPublicIdentifier(channel.userIdentifiers[0]),
            getSignerAddressFromPublicIdentifier(channel.userIdentifiers[1]),
          ];
          const actualOwners = await multisig.getOwners();

          if (!(expectedOwners[0] === actualOwners[0] && expectedOwners[1] === actualOwners[1])) {
            // wait on a linear backoff interval before retrying
            await delay(1000 * tryCount);
            throw new Error(
              `${CHANNEL_CREATION_FAILED}: Could not confirm, on the ${tryCount} try, that the deployed multisig has the expected owners`,
            );
          }

          log.info(`Multisig deployment complete for ${channel.multisigAddress}`);
          result = { transactionHash: tx.hash! };
          break;

        } catch (e) {
          const message = e?.body?.error?.message || e.message;
          log.warn(e.message);
          if (message.includes("the tx doesn't have the correct nonce")) {
            log.warn(`Nonce conflict, trying again real quick: ${message}`);
            tryCount -= 1; // Nonce conflicts don't count as retrys bc no gas spent
            memoryNonce = parseInt(message.match(/account has nonce of: (\d+)/)[1], 10);
            continue;
          }
          error = e;
          log.error(`Deployment attempt ${tryCount} failed: ${message}`);
          log.warn(`Retrying ${retryCount - tryCount} more times`);
        }
      }
    }

    this.inProgress = false;
    if (error) {
      throw new Error(`${CHANNEL_CREATION_FAILED}: ${stringify(error)}`);
    }
    return result;

  }
}
