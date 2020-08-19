import { DEFAULT_APP_TIMEOUT } from "@connext/apps";
import {
  ConditionalTransferTypes,
  EventNames,
  MethodParams,
  PublicParams,
  PublicResults,
  GenericConditionalTransferAppState,
  CreatedHashLockTransferMeta,
  CreatedSignedTransferMeta,
  CreatedLinkedTransferMeta,
  SimpleLinkedTransferAppState,
  SimpleSignedTransferAppState,
  HashLockTransferAppState,
  GraphBatchedTransferAppState,
  CreatedGraphBatchedTransferMeta,
  EIP712Domain,
  DOMAIN_NAME,
  DOMAIN_VERSION,
  DOMAIN_SALT,
  GRAPH_BATCHED_SWAP_CONVERSION,
  GraphSignedTransferAppState,
  CreatedGraphSignedTransferMeta,
} from "@connext/types";
import {
  toBN,
  stringify,
  hashDomainSeparator,
  getAddressFromAssetId,
  getSignerAddressFromPublicIdentifier,
} from "@connext/utils";
import { constants, utils, BigNumber } from "ethers";

import { AbstractController } from "./AbstractController";

const { HashZero, Zero } = constants;
const { soliditySha256 } = utils;

export class CreateTransferController extends AbstractController {
  public createTransfer = async (
    params: PublicParams.ConditionalTransfer,
  ): Promise<PublicResults.ConditionalTransfer> => {
    this.log.info(`conditionalTransfer started: ${stringify(params)}`);

    const amount = toBN(params.amount);
    const { meta, recipient } = params;
    const assetId = getAddressFromAssetId(params.assetId);
    let conditionType = params.conditionType;

    const submittedMeta = { ...(meta || {}) };
    submittedMeta.recipient = recipient;
    submittedMeta.sender = this.connext.publicIdentifier;
    submittedMeta.senderAssetId = assetId;

    const baseInitialState: GenericConditionalTransferAppState = {
      coinTransfers: [
        {
          amount,
          to: this.connext.signerAddress,
        },
        {
          amount: Zero,
          to: this.connext.nodeSignerAddress,
        },
      ],
      finalized: false,
    };

    let transferMeta: any;

    let initialState:
      | SimpleLinkedTransferAppState
      | HashLockTransferAppState
      | SimpleSignedTransferAppState
      | GraphBatchedTransferAppState
      | GraphSignedTransferAppState;


    // Set transferMeta & submittedMeta & initialState according to conditionType
    switch (conditionType) {
      case ConditionalTransferTypes.OnlineTransfer: {
        // Under the hood, still use the LinkedTransfer contract & logic
        conditionType = ConditionalTransferTypes.LinkedTransfer;
        submittedMeta.requireOnline = true;
      }
      // OnlineTransfer is almost the same as LinkedTransfer: only difference is requireOnline
      // eslint-disable-next-line no-fallthrough
      case ConditionalTransferTypes.LinkedTransfer: {
        const { preImage, paymentId } = params as PublicParams.LinkedTransfer;
        const linkedHash = soliditySha256(["bytes32"], [preImage]);

        initialState = {
          ...baseInitialState,
          linkedHash,
          preImage: HashZero,
        } as SimpleLinkedTransferAppState;

        // add encrypted preImage to meta so node can store it in the DB
        if (recipient) {
          const encryptedPreImage = await this.channelProvider.encrypt(preImage, recipient);
          submittedMeta.encryptedPreImage = encryptedPreImage;
        }
        submittedMeta.paymentId = paymentId;

        transferMeta = {} as CreatedLinkedTransferMeta;

        break;
      }
      case ConditionalTransferTypes.HashLockTransfer: {
        const { lockHash, timelock } = params as PublicParams.HashLockTransfer;

        // convert to block height
        const currentBlock = await this.connext.ethProvider.getBlockNumber();
        const expiry = toBN(timelock).add(currentBlock);
        this.log.info(
          `HashLockTransfer with timelock ${timelock} will expire at block ${expiry} (currentBlock=${currentBlock})`,
        );
        initialState = {
          ...baseInitialState,
          lockHash,
          preImage: HashZero,
          expiry,
        } as HashLockTransferAppState;

        const paymentId = soliditySha256(["address", "bytes32"], [assetId, lockHash]);
        submittedMeta.paymentId = paymentId;
        submittedMeta.timelock = timelock;

        transferMeta = {
          expiry,
          timelock,
          lockHash,
        } as CreatedHashLockTransferMeta;

        break;
      }
      case ConditionalTransferTypes.GraphTransfer: {
        const {
          chainId,
          verifyingContract,
          requestCID,
          subgraphDeploymentID,
          signerAddress,
          paymentId,
        } = params as PublicParams.GraphTransfer;

        initialState = {
          ...baseInitialState,
          chainId,
          verifyingContract,
          requestCID,
          subgraphDeploymentID,
          paymentId,
          signerAddress,
        } as GraphSignedTransferAppState;

        transferMeta = {
          signerAddress,
          chainId,
          verifyingContract,
          requestCID,
          subgraphDeploymentID,
        } as CreatedGraphSignedTransferMeta;

        submittedMeta.paymentId = paymentId;

        break;
      }
      case ConditionalTransferTypes.GraphBatchedTransfer: {
        const {
          consumerSigner,
          chainId,
          verifyingContract,
          subgraphDeploymentID,
          paymentId,
        } = params as PublicParams.GraphBatchedTransfer;

        // indexer
        const attestationSigner = getSignerAddressFromPublicIdentifier(recipient);
        const swapRate = BigNumber.from(1).mul(GRAPH_BATCHED_SWAP_CONVERSION);

        initialState = {
          ...baseInitialState,
          chainId,
          verifyingContract,
          subgraphDeploymentID,
          paymentId,
          attestationSigner, // indexer
          consumerSigner,
          swapRate,
        } as GraphBatchedTransferAppState;

        transferMeta = {
          attestationSigner,
          consumerSigner,
          chainId,
          verifyingContract,
          subgraphDeploymentID,
          swapRate,
        } as CreatedGraphBatchedTransferMeta;

        submittedMeta.paymentId = paymentId;

        break;
      }
      case ConditionalTransferTypes.SignedTransfer: {
        const {
          signerAddress,
          chainId,
          verifyingContract,
          paymentId,
        } = params as PublicParams.SignedTransfer;

        const domainSeparator: EIP712Domain = {
          name: DOMAIN_NAME,
          version: DOMAIN_VERSION,
          chainId,
          verifyingContract,
          salt: DOMAIN_SALT,
        };

        initialState = {
          ...baseInitialState,
          signerAddress,
          chainId,
          verifyingContract,
          paymentId,
          domainSeparator: hashDomainSeparator(domainSeparator),
        } as SimpleSignedTransferAppState;

        transferMeta = {
          signerAddress,
          chainId,
          verifyingContract,
        } as CreatedSignedTransferMeta;

        submittedMeta.paymentId = paymentId;

        break;
      }
      default: {
        const c: never = conditionType;
        this.log.error(`Invalid condition type ${c}`);
      }
    }

    const transferAppRegistryInfo = this.connext.appRegistry.find(
      (app) => app.name === conditionType,
    );
    if (!transferAppRegistryInfo) {
      throw new Error(`transferAppRegistryInfo not found for ${conditionType}`);
    }
    const {
      actionEncoding,
      appDefinitionAddress: appDefinition,
      stateEncoding,
      outcomeType,
    } = transferAppRegistryInfo;
    const proposeInstallParams: MethodParams.ProposeInstall = {
      abiEncodings: {
        actionEncoding,
        stateEncoding,
      },
      appDefinition,
      initialState,
      initiatorDeposit: amount,
      initiatorDepositAssetId: assetId,
      meta: submittedMeta,
      multisigAddress: this.connext.multisigAddress,
      outcomeType,
      responderIdentifier: this.connext.nodeIdentifier,
      responderDeposit: Zero,
      responderDepositAssetId: assetId,
      defaultTimeout: DEFAULT_APP_TIMEOUT,
      stateTimeout: Zero,
    };
    this.log.debug(`Installing transfer app ${conditionType}`);
    const appIdentityHash = await this.proposeAndInstallLedgerApp(proposeInstallParams);
    this.log.debug(`Installed ${conditionType} ${appIdentityHash}`);

    if (!appIdentityHash) {
      throw new Error(`App was not installed`);
    }

    const eventData = {
      type: conditionType,
      amount,
      appIdentityHash,
      assetId,
      sender: this.connext.publicIdentifier,
      meta: submittedMeta,
      paymentId: submittedMeta.paymentId,
      recipient,
      transferMeta,
    };
    this.connext.emit(EventNames.CONDITIONAL_TRANSFER_CREATED_EVENT, eventData);
    const result: PublicResults.ConditionalTransfer = {
      amount,
      appIdentityHash,
      assetId,
      sender: this.connext.publicIdentifier,
      meta: submittedMeta,
      paymentId: submittedMeta.paymentId,
      preImage: (params as PublicParams.LinkedTransfer).preImage,
      recipient,
      transferMeta,
    };
    this.log.info(
      `conditionalTransfer ${conditionType} for paymentId ${
        submittedMeta.paymentId
      } complete: ${JSON.stringify(result)}`,
    );
    return result;
  };
}
