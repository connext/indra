import {
  ConditionalTransferTypes,
  EventNames,
  EventPayloads,
  IConnextClient,
  ILoggerService,
  PublicParams,
} from "@connext/types";
import {
  getTestReceiptToSign,
  getTestVerifyingContract,
  signReceiptMessage,
  stringify,
} from "@connext/utils";
import { utils, constants, BigNumber } from "ethers";
const { hexlify, randomBytes } = utils;
const { AddressZero } = constants;

export class Agent {
  private payments: { [k: string]: { resolve: () => void; reject: () => void } } = {};

  constructor(
    private readonly log: ILoggerService,
    private readonly client: IConnextClient,
    private readonly privateKey: string,
  ) {}

  async start() {
    const receipt = getTestReceiptToSign();
    const { chainId } = await this.client.ethProvider.getNetwork();
    const verifyingContract = getTestVerifyingContract();

    this.client.on(EventNames.CONDITIONAL_TRANSFER_CREATED_EVENT, async (eData) => {
      const eventData = eData as EventPayloads.SignedTransferCreated;
      // ignore transfers from self
      if (eventData.sender === this.client.publicIdentifier) {
        return;
      }

      this.log.debug(`Received transfer: ${stringify(eventData)}`);

      if (this.client.signerAddress !== eventData.transferMeta.signerAddress) {
        this.log.error(
          `Transfer's specified signer ${eventData.transferMeta.signerAddress} does not match our signer ${this.client.signerAddress}`,
        );
        return;
      }

      const signature = await signReceiptMessage(
        receipt,
        chainId,
        verifyingContract,
        this.privateKey,
      );
      this.log.info(`Unlocking transfer with signature ${signature}`);
      const start = Date.now();
      await this.client.resolveCondition({
        conditionType: ConditionalTransferTypes.SignedTransfer,
        paymentId: eventData.paymentId,
        responseCID: receipt.responseCID,
        signature,
      } as PublicParams.ResolveSignedTransfer);
      this.log.info(
        `Unlocked transfer ${eventData.paymentId} for (${eventData.amount} ETH). Elapsed: ${
          Date.now() - start
        }`,
      );
    });

    this.client.on(EventNames.CONDITIONAL_TRANSFER_UNLOCKED_EVENT, async (eData) => {
      if (!eData.paymentId) {
        this.log.info(`Ignoring untracked transfer ${eData.paymentId}.`);
        return;
      }
      const resolver = this.payments[eData.paymentId];
      if (!resolver) {
        return;
      }
      resolver.resolve();
    });
  }

  async deposit(amount: BigNumber) {
    await this.client.deposit({
      amount: amount,
      assetId: AddressZero,
    });
  }

  async pay(receiverIdentifier: string, signerAddress: string, amount: BigNumber) {
    const id = hexlify(randomBytes(32));
    const receipt = getTestReceiptToSign();
    const verifyingContract = getTestVerifyingContract();
    const { chainId } = await this.client.ethProvider.getNetwork();
    await new Promise((resolve, reject) => {
      this.client
        .conditionalTransfer({
          amount: amount,
          conditionType: ConditionalTransferTypes.SignedTransfer,
          paymentId: id,
          signerAddress,
          chainId,
          verifyingContract,
          requestCID: receipt.requestCID,
          subgraphDeploymentID: receipt.subgraphDeploymentID,
          assetId: AddressZero,
          recipient: receiverIdentifier,
        })
        .then(() => {
          this.log.info(`Initiated transfer with ID ${id}.`);
        })
        .catch(() => {
          delete this.payments[id];
          reject();
        });

      this.payments[id] = {
        resolve,
        reject,
      };
    });
  }
}
