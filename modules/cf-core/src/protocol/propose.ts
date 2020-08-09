import {
  Opcode,
  ProposeMiddlewareContext,
  ProtocolNames,
  ProtocolParams,
  ProtocolRoles,
} from "@connext/types";
import { getSignerAddressFromPublicIdentifier, logTime, stringify } from "@connext/utils";

import { UNASSIGNED_SEQ_NO } from "../constants";
import { getSetStateCommitment, getConditionalTransactionCommitment } from "../ethereum";
import { AppInstance } from "../models";
import { Context, PersistAppType, ProtocolExecutionFlow } from "../types";

import {
  assertIsValidSignature,
  computeInterpreterParameters,
  generateProtocolMessageData,
  parseProtocolMessage,
} from "./utils";

const protocol = ProtocolNames.propose;
const { OP_SIGN, OP_VALIDATE, IO_SEND, IO_SEND_AND_WAIT, PERSIST_APP_INSTANCE } = Opcode;

/**
 * @description This exchange is described at the following URL:
 *
 */
export const PROPOSE_PROTOCOL: ProtocolExecutionFlow = {
  0 /* Initiating */: async function* (context: Context) {
    const { message, preProtocolStateChannel, networks } = context;
    const log = context.log.newContext("CF-ProposeProtocol");
    const start = Date.now();
    let substart = start;
    const { processID, params } = message.data;
    const loggerId = params?.multisigAddress || processID;
    log.info(`[${loggerId}] Initiation started`);
    log.debug(`[${loggerId}] Initiation started: ${stringify(params, true, 0)}`);

    const {
      abiEncodings,
      appDefinition,
      defaultTimeout,
      initialState,
      initiatorDeposit,
      initiatorDepositAssetId,
      initiatorIdentifier,
      meta,
      outcomeType,
      responderDeposit,
      responderDepositAssetId,
      responderIdentifier,
      stateTimeout,
    } = params as ProtocolParams.Propose;

    if (!params) throw new Error("No params found for proposal");
    if (!preProtocolStateChannel) throw new Error("No state channel found for proposal");

    const interpreterParams = computeInterpreterParameters(
      preProtocolStateChannel.multisigOwners,
      outcomeType,
      initiatorDepositAssetId,
      responderDepositAssetId,
      initiatorDeposit,
      responderDeposit,
      getSignerAddressFromPublicIdentifier(initiatorIdentifier),
      getSignerAddressFromPublicIdentifier(responderIdentifier),
      true,
    );

    const proposal = new AppInstance(
      /* multisigAddres */ preProtocolStateChannel!.multisigAddress,
      /* initiator */ initiatorIdentifier,
      /* initiatorDeposit */ initiatorDeposit.toHexString(),
      /* initiatorDepositAssetId */ initiatorDepositAssetId,
      /* responder */ responderIdentifier,
      /* responderDeposit */ responderDeposit.toHexString(),
      /* responderDepositAssetId */ responderDepositAssetId,
      /* abiEncodings */ abiEncodings,
      /* appDefinition */ appDefinition,
      /* appSeqNo */ preProtocolStateChannel!.numProposedApps + 1,
      /* latestState */ initialState,
      /* latestVersionNumber */ 1,
      /* defaultTimeout */ defaultTimeout.toHexString(),
      /* stateTimeout */ stateTimeout.toHexString(),
      /* outcomeType */ outcomeType,
      /* interpreterParamsInternal*/ interpreterParams,
      /* meta */ meta,
    );
    const proposalJson = proposal.toJson();

    const error = yield [
      OP_VALIDATE,
      protocol,
      {
        proposal: proposalJson,
        params,
        role: ProtocolRoles.initiator,
        stateChannel: preProtocolStateChannel!.toJson(),
      } as ProposeMiddlewareContext,
    ];
    if (!!error) {
      throw new Error(error);
    }
    logTime(log, substart, `[${loggerId}] Validated proposal ${proposal.identityHash}`);
    substart = Date.now();

    // 0 ms
    const postProtocolStateChannel = preProtocolStateChannel!.addProposal(proposalJson);

    const setStateCommitment = getSetStateCommitment(
      networks[preProtocolStateChannel.chainId],
      proposal as AppInstance,
    );

    const conditionalTxCommitment = getConditionalTransactionCommitment(
      networks[preProtocolStateChannel.chainId],
      postProtocolStateChannel,
      proposal as AppInstance,
    );

    substart = Date.now();

    const setStateCommitmentHash = setStateCommitment.hashToSign();
    const initiatorSignatureOnInitialState = yield [OP_SIGN, setStateCommitmentHash];

    const conditionalTxCommitmentHash = conditionalTxCommitment.hashToSign();
    const initiatorSignatureOnConditionalTransaction = yield [OP_SIGN, conditionalTxCommitmentHash];
    logTime(
      log,
      substart,
      `[${loggerId}] Signed set state commitment ${setStateCommitmentHash} & conditional transfer commitment ${conditionalTxCommitmentHash}`,
    );

    const m1 = generateProtocolMessageData(responderIdentifier, protocol, processID, 1, params, {
      customData: {
        signature: initiatorSignatureOnInitialState,
        signature2: initiatorSignatureOnConditionalTransaction,
      },
      prevMessageReceived: start,
    });
    substart = Date.now();

    // 200ms
    const { message: m2 } = (yield [IO_SEND_AND_WAIT, m1])!;
    logTime(log, substart, `[${loggerId}] Received responder's m2`);
    substart = Date.now();

    const {
      data: {
        customData: {
          signature: responderSignatureOnInitialState,
          signature2: responderSignatureOnConditionalTransaction,
        },
      },
    } = parseProtocolMessage(m2);

    substart = Date.now();
    await assertIsValidSignature(
      getSignerAddressFromPublicIdentifier(responderIdentifier),
      setStateCommitmentHash,
      responderSignatureOnInitialState,
      `Failed to validate responders signature on initial set state commitment in the propose protocol. Our commitment: ${stringify(
        setStateCommitment.toJson(),
        true,
        0,
      )}. Initial state: ${stringify(initialState, true, 0)}`,
    );
    logTime(log, substart, `[${loggerId}] Asserted valid responder signature set state commitment`);

    substart = Date.now();
    await assertIsValidSignature(
      getSignerAddressFromPublicIdentifier(responderIdentifier),
      conditionalTxCommitmentHash,
      responderSignatureOnConditionalTransaction,
      `Failed to validate responders signature on conditional transaction commitment in the propose protocol. Our commitment: ${stringify(
        conditionalTxCommitment.toJson(),
        true,
        0,
      )}. Initial state: ${stringify(initialState, true, 0)}`,
    );
    logTime(
      log,
      substart,
      `[${loggerId}] Asserted valid responder signature on conditional transaction`,
    );

    // add signatures to commitment and save
    await setStateCommitment.addSignatures(
      initiatorSignatureOnInitialState as any,
      responderSignatureOnInitialState,
    );
    await conditionalTxCommitment.addSignatures(
      initiatorSignatureOnConditionalTransaction as any,
      responderSignatureOnConditionalTransaction,
    );

    substart = Date.now();

    // 78 ms(!)
    yield [
      PERSIST_APP_INSTANCE,
      PersistAppType.CreateProposal,
      postProtocolStateChannel,
      proposalJson,
      setStateCommitment,
      conditionalTxCommitment,
    ];
    logTime(log, substart, `[${loggerId}] Persisted app instance ${proposalJson.identityHash}`);
    substart = Date.now();

    // Total 298ms
    logTime(log, start, `[${loggerId}] Initiation finished`);
  },

  1 /* Responding */: async function* (context: Context) {
    const { message, preProtocolStateChannel, networks } = context;
    const { params, processID } = message.data;
    const log = context.log.newContext("CF-ProposeProtocol");
    const start = Date.now();
    let substart = start;
    const loggerId = params?.multisigAddress || processID;
    log.info(`[${loggerId}] Response started`);
    log.debug(
      `[${loggerId}] Protocol response started with parameters ${stringify(params, true, 0)}`,
    );

    const {
      abiEncodings,
      appDefinition,
      defaultTimeout,
      initialState,
      initiatorDeposit,
      initiatorDepositAssetId,
      initiatorIdentifier,
      meta,
      outcomeType,
      responderDeposit,
      responderDepositAssetId,
      responderIdentifier,
      stateTimeout,
    } = params as ProtocolParams.Propose;

    const {
      customData: {
        signature: initiatorSignatureOnInitialState,
        signature2: initiatorSignatureOnConditionalTransaction,
      },
    } = message.data;

    if (!params) {
      throw new Error("No params found for proposal");
    }
    if (!preProtocolStateChannel) {
      throw new Error("No state channel found for proposal");
    }

    const interpreterParams = computeInterpreterParameters(
      preProtocolStateChannel.multisigOwners,
      outcomeType,
      initiatorDepositAssetId,
      responderDepositAssetId,
      initiatorDeposit,
      responderDeposit,
      getSignerAddressFromPublicIdentifier(initiatorIdentifier),
      getSignerAddressFromPublicIdentifier(responderIdentifier),
      true,
    );

    const proposal = new AppInstance(
      /* multisigAddres */ preProtocolStateChannel!.multisigAddress,
      /* initiator */ initiatorIdentifier,
      /* initiatorDeposit */ initiatorDeposit.toHexString(),
      /* initiatorDepositAssetId */ initiatorDepositAssetId,
      /* responder */ responderIdentifier,
      /* responderDeposit */ responderDeposit.toHexString(),
      /* responderDepositAssetId */ responderDepositAssetId,
      /* abiEncodings */ abiEncodings,
      /* appDefinition */ appDefinition,
      /* appSeqNo */ preProtocolStateChannel!.numProposedApps + 1,
      /* latestState */ initialState,
      /* latestVersionNumber */ 1,
      /* defaultTimeout */ defaultTimeout.toHexString(),
      /* stateTimeout */ stateTimeout.toHexString(),
      /* outcomeType */ outcomeType,
      /* interpreterParamsInternal*/ interpreterParams,
      /* meta */ meta,
    );
    const proposalJson = proposal.toJson();

    const error = yield [
      OP_VALIDATE,
      protocol,
      {
        proposal: proposalJson,
        params,
        role: ProtocolRoles.responder,
        stateChannel: preProtocolStateChannel!.toJson(),
      } as ProposeMiddlewareContext,
    ];
    if (!!error) {
      throw new Error(error);
    }
    logTime(log, substart, `[${loggerId}] Validated proposal ${proposal.identityHash}`);
    substart = Date.now();

    // 0ms
    const postProtocolStateChannel = preProtocolStateChannel!.addProposal(proposalJson);

    const setStateCommitment = getSetStateCommitment(
      networks[preProtocolStateChannel.chainId],
      proposal as AppInstance,
    );
    const setStateCommitmentHash = setStateCommitment.hashToSign();

    const conditionalTxCommitment = getConditionalTransactionCommitment(
      networks[preProtocolStateChannel.chainId],
      postProtocolStateChannel,
      proposal as AppInstance,
    );
    const conditionalTxCommitmentHash = conditionalTxCommitment.hashToSign();

    substart = Date.now();
    await assertIsValidSignature(
      getSignerAddressFromPublicIdentifier(initiatorIdentifier),
      setStateCommitmentHash,
      initiatorSignatureOnInitialState,
      `Failed to validate initiator's signature on initial set state commitment in the propose protocol. Process: ${processID}. Our commitment: ${stringify(
        setStateCommitment.toJson(),
        true,
        0,
      )}. Initial state: ${stringify(initialState, true, 0)}`,
    );
    logTime(log, substart, `[${loggerId}] Asserted valid signature responder propose`);

    substart = Date.now();
    await assertIsValidSignature(
      getSignerAddressFromPublicIdentifier(initiatorIdentifier),
      conditionalTxCommitmentHash,
      initiatorSignatureOnConditionalTransaction,
      `Failed to validate initiator's signature on conditional transaction commitment in the propose protocol. Our commitment: ${stringify(
        conditionalTxCommitment.toJson(),
        true,
        0,
      )}. Initial state: ${stringify(initialState, true, 0)}`,
    );
    logTime(
      log,
      substart,
      `[${loggerId}] Asserted valid initiator signature on conditional transaction`,
    );

    substart = Date.now();
    // 12ms
    const responderSignatureOnInitialState = yield [OP_SIGN, setStateCommitmentHash];
    logTime(log, substart, `[${loggerId}] Signed initial state responder propose`);
    const responderSignatureOnConditionalTransaction = yield [OP_SIGN, conditionalTxCommitmentHash];
    logTime(log, substart, `[${loggerId}] Signed conditional tx commitment`);
    await setStateCommitment.addSignatures(
      initiatorSignatureOnInitialState,
      responderSignatureOnInitialState,
    );
    await conditionalTxCommitment.addSignatures(
      initiatorSignatureOnConditionalTransaction,
      responderSignatureOnConditionalTransaction as any,
    );

    substart = Date.now();
    // 98ms
    // will also save the app array into the state channel
    yield [
      PERSIST_APP_INSTANCE,
      PersistAppType.CreateProposal,
      postProtocolStateChannel,
      proposalJson,
      setStateCommitment,
      conditionalTxCommitment,
    ];
    logTime(log, substart, `[${loggerId}] Persisted app instance ${proposalJson.identityHash}`);

    // 0ms
    yield [
      IO_SEND,
      generateProtocolMessageData(
        initiatorIdentifier,
        protocol,
        processID,
        UNASSIGNED_SEQ_NO,
        params,
        {
          prevMessageReceived: start,
          customData: {
            signature: responderSignatureOnInitialState,
            signature2: responderSignatureOnConditionalTransaction,
          },
        },
      ),
      postProtocolStateChannel,
    ];

    substart = Date.now();
    logTime(log, start, `[${loggerId}] Response finished`);
  },
};
