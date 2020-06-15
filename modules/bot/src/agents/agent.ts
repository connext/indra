import {
  ConditionalTransferTypes,
  EventNames,
  EventPayloads,
  IConnextClient,
  ILoggerService,
  PublicParams,
} from "@connext/types";
import {
  abrv,
  delay,
  getRandomBytes32,
  getTestReceiptToSign,
  getTestVerifyingContract,
  signReceiptMessage,
  stringify,
} from "@connext/utils";
import { constants, BigNumber } from "ethers";
const { AddressZero } = constants;

export class Agent {
  private payments: {
    [k: string]: { resolve: () => void; reject: (msg?: string | Error) => void };
  } = {};

  // Tracks all apps associated with this client and the paymentId
  private apps: {
    [appId: string]: string; // { appId: paymentId }
  } = {};

  public lastReceivedOn = Date.now();

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

      this.log.info(`Receiving transfer from ${abrv(eventData.sender)} with id ${abrv(eventData.paymentId || "???")}`);

      if (this.client.signerAddress !== eventData.transferMeta.signerAddress) {
        this.log.error(
          `Transfer's specified signer ${eventData.transferMeta.signerAddress} does not match our signer ${this.client.signerAddress}`,
        );
        return;
      }

      this.lastReceivedOn = Date.now();

      const signature = await signReceiptMessage(
        receipt,
        chainId,
        verifyingContract,
        this.privateKey,
      );
      this.log.debug(`Unlocking transfer with signature ${signature}`);
      const start = Date.now();
      await this.client.resolveCondition({
        conditionType: ConditionalTransferTypes.SignedTransfer,
        paymentId: eventData.paymentId,
        responseCID: receipt.responseCID,
        signature,
      } as PublicParams.ResolveSignedTransfer);
      this.log.info(`Received transfer ${abrv(eventData.paymentId || "???")}. Elapsed: ${Date.now() - start}`);
    });

    this.client.on(EventNames.CONDITIONAL_TRANSFER_UNLOCKED_EVENT, async (eData) => {
      if (!eData.paymentId) {
        this.log.warn(`Ignoring untracked transfer ${eData.paymentId}.`);
        return;
      }
      const resolver = this.payments[eData.paymentId];
      if (!resolver) {
        return;
      }
      delete this.payments[eData.paymentId];
      resolver.resolve();
    });

    // Add listener to associate paymentId with appId
    this.client.on(EventNames.PROPOSE_INSTALL_EVENT, async (eData) => {
      const paymentId = eData.params.meta?.["paymentId"];
      if (!paymentId || !this.payments[paymentId]) {
        return;
      }
      this.apps[eData.appInstanceId] = paymentId;
    });

    // Add failure listeners
    this.client.on(EventNames.CONDITIONAL_TRANSFER_FAILED_EVENT, async (eData) => {
      if (!eData.paymentId) {
        this.log.warn(`Ignoring untracked transfer ${eData.paymentId}.`);
        return;
      }
      this.retrieveResolverAndReject(eData.paymentId, eData.error);
    });

    this.client.on(EventNames.PROPOSE_INSTALL_FAILED_EVENT, async (eData) => {
      const paymentId = eData.params.meta?.["paymentId"];
      if (!paymentId) {
        this.log.warn(`Ignoring untracked proposal failure ${stringify(eData)}.`);
        return;
      }
      this.retrieveResolverAndReject(paymentId, eData.error);
    });

    this.client.on(EventNames.INSTALL_FAILED_EVENT, async (eData) => {
      const paymentId = eData.params.proposal.meta?.["paymentId"];
      if (!paymentId) {
        this.log.warn(`Ignoring untracked install failure ${stringify(eData)}.`);
        return;
      }
      this.retrieveResolverAndReject(paymentId, eData.error);
    });

    this.client.on(EventNames.UPDATE_STATE_FAILED_EVENT, async (eData) => {
      const appId = eData.params.appIdentityHash;
      if (!appId || !this.apps[appId]) {
        this.log.warn(`Ignoring untracked take action failure ${stringify(eData)}.`);
        return;
      }
      this.retrieveResolverAndReject(this.apps[appId], eData.error);
    });

    this.client.on(EventNames.UNINSTALL_FAILED_EVENT, async (eData) => {
      const appId = eData.params.appIdentityHash;
      if (!appId || !this.apps[appId]) {
        this.log.warn(`Ignoring untracked uninstall failure ${stringify(eData)}.`);
        return;
      }
      this.retrieveResolverAndReject(this.apps[appId], eData.error);
    });
  }

  async deposit(amount: BigNumber, assetId: string = AddressZero) {
    // Perform deposit
    await this.client.deposit({
      amount,
      assetId,
    });
  }

  async depositIfNeeded(
    minimumBalance: BigNumber,
    depositAmount: BigNumber,
    assetId: string = AddressZero,
  ) {
    // deposit if requested + needed
    const balance = await this.client.getFreeBalance(assetId);
    this.log.debug(`Agent balance: ${balance[this.client.signerAddress]}`);
    if (balance[this.client.signerAddress].gte(minimumBalance)) {
      return;
    }
    this.log.warn(
      `Balance too low: ${balance[
        this.client.signerAddress
      ].toString()} < ${minimumBalance.toString()}, depositing...`,
    );
    await this.deposit(depositAmount);
    const balanceAfterDeposit = await this.client.getFreeBalance(assetId);
    this.log.info(
      `Finished depositing. Agent balance: ${balanceAfterDeposit[this.client.signerAddress]}`,
    );
  }

  async pay(
    receiverIdentifier: string,
    signerAddress: string,
    amount: BigNumber,
    id: string = getRandomBytes32(),
    type: ConditionalTransferTypes = ConditionalTransferTypes.SignedTransfer,
  ) {
    const params = await this.getTransferParameters(
      receiverIdentifier,
      signerAddress,
      amount,
      id,
      type,
    );

    return new Promise((resolve, reject) => {
      const start = Date.now();
      this.client
        .conditionalTransfer(params)
        .then(() => {
          this.log.info(`Sent transfer ${abrv(id)}. Elapsed: ${Date.now() - start} ms`);
        })
        .catch((e) => {
          delete this.payments[id];
          return reject(e);
        });

      this.payments[id] = {
        resolve,
        reject,
      };

      const timeout = 7500;
      delay(timeout).then(() => {
        if (this.payments[id]) {
          delete this.payments[id];
          return reject(new Error(`Payment ${id} timed out after ${timeout/1000} s`));
        }
      });
    });
  }

  ///// Private methods
  private retrieveResolverAndReject(paymentId: string, msg: string) {
    const resolver = this.payments[paymentId];
    if (!resolver) {
      return;
    }
    delete this.payments[paymentId];
    const [appId] = Object.entries(this.apps).find(([appId, id]) => id === paymentId) || [];
    if (appId) {
      delete this.apps[appId];
    }
    resolver.reject(new Error(msg));
  }

  private async getTransferParameters(
    receiverIdentifier: string,
    signerAddress: string,
    amount: BigNumber,
    id: string,
    type: ConditionalTransferTypes,
  ) {
    const baseParams = {
      conditionType: type as any,
      amount,
      assetId: AddressZero,
      recipient: receiverIdentifier,
    };
    switch (type) {
      case ConditionalTransferTypes.SignedTransfer: {
        const { chainId } = await this.client.ethProvider.getNetwork();
        const receipt = getTestReceiptToSign();
        const verifyingContract = getTestVerifyingContract();
        return {
          ...baseParams,
          paymentId: id,
          signerAddress,
          chainId,
          verifyingContract,
          requestCID: receipt.requestCID,
          subgraphDeploymentID: receipt.subgraphDeploymentID,
        };
      }
      default: {
        throw new Error("Unrecognized payment type");
      }
    }
  }
}
