import {
  AppInstanceProposal,
  Opcode,
  ProposeMiddlewareContext,
  ProtocolMessageData,
  ProtocolNames,
  ProtocolParams,
  ProtocolRoles,
  CONVENTION_FOR_ETH_ASSET_ID,
} from "@connext/types";
import { getSignerAddressFromPublicIdentifier, logTime, toBN, stringify } from "@connext/utils";
import { defaultAbiCoder, keccak256 } from "ethers/utils";

import { UNASSIGNED_SEQ_NO } from "../constants";
import { getSetStateCommitment } from "../ethereum";
import { AppInstance } from "../models";
import { Context, PersistAppType, ProtocolExecutionFlow } from "../types";
import { appIdentityToHash } from "../utils";

import { assertIsValidSignature, stateChannelClassFromStoreByMultisig } from "./utils";

const protocol = ProtocolNames.propose;
const { OP_SIGN, OP_VALIDATE, IO_SEND, IO_SEND_AND_WAIT, PERSIST_APP_INSTANCE } = Opcode;

/**
 * @description This exchange is described at the following URL:
 *
 */
export const PROPOSE_PROTOCOL: ProtocolExecutionFlow = {
  0 /* Initiating */: async function* (context: Context) {
    const { message, store } = context;
    const log = context.log.newContext("CF-ProposeProtocol");
    const start = Date.now();
    let substart = start;
    log.info(`Initiation started`);

    const { processID, params } = message;

    const {
      abiEncodings,
      appDefinition,
      defaultTimeout,
      initialState,
      initiatorDeposit,
      initiatorDepositAssetId,
      initiatorIdentifier,
      meta,
      multisigAddress,
      outcomeType,
      responderDeposit,
      responderDepositAssetId,
      responderIdentifier,
      stateTimeout,
    } = params as ProtocolParams.Propose;

    const preProtocolStateChannel = await stateChannelClassFromStoreByMultisig(
      multisigAddress,
      store,
    );

    // 7ms
    const appInstanceProposal: AppInstanceProposal = {
      appDefinition,
      abiEncodings,
      initialState,
      outcomeType,
      initiatorDeposit: initiatorDeposit.toHexString(),
      responderDeposit: responderDeposit.toHexString(),
      defaultTimeout: defaultTimeout.toHexString(),
      stateTimeout: stateTimeout.toHexString(),
      identityHash: appIdentityToHash({
        appDefinition,
        channelNonce: toBN(preProtocolStateChannel.numProposedApps + 1),
        participants: preProtocolStateChannel.getSigningKeysFor(
          initiatorIdentifier,
          responderIdentifier,
        ),
        multisigAddress: preProtocolStateChannel.multisigAddress,
        defaultTimeout,
      }),
      initiatorIdentifier,
      responderIdentifier,
      appSeqNo: preProtocolStateChannel.numProposedApps + 1,
      initiatorDepositAssetId: initiatorDepositAssetId || CONVENTION_FOR_ETH_ASSET_ID,
      responderDepositAssetId: responderDepositAssetId || CONVENTION_FOR_ETH_ASSET_ID,
      meta,
    };

    yield [
      OP_VALIDATE,
      protocol,
      {
        proposal: appInstanceProposal,
        params,
        role: ProtocolRoles.initiator,
      } as ProposeMiddlewareContext,
    ];

    // 0 ms
    const postProtocolStateChannel = preProtocolStateChannel.addProposal(appInstanceProposal);

    const proposedAppInstance = {
      identity: {
        appDefinition,
        channelNonce: toBN(preProtocolStateChannel.numProposedApps + 1),
        participants: preProtocolStateChannel.getSigningKeysFor(
          initiatorIdentifier,
          responderIdentifier,
        ),
        multisigAddress: preProtocolStateChannel.multisigAddress,
        defaultTimeout: toBN(defaultTimeout),
      },
      hashOfLatestState: keccak256(
        defaultAbiCoder.encode([abiEncodings.stateEncoding], [initialState]),
      ),
      versionNumber: 1,
      stateTimeout: stateTimeout.toHexString(),
    };

    const setStateCommitment = getSetStateCommitment(context, proposedAppInstance as AppInstance);

    substart = Date.now();
    // 6ms
    const initiatorSignatureOnInitialState = yield [OP_SIGN, setStateCommitment.hashToSign()];
    logTime(log, substart, `Signed initial state initiator propose`);

    const m1 = {
      protocol,
      processID,
      params,
      seq: 1,
      to: responderIdentifier,
      customData: {
        signature: initiatorSignatureOnInitialState,
      },
    } as ProtocolMessageData;

    substart = Date.now();

    // 200ms
    const m2 = yield [IO_SEND_AND_WAIT, m1];
    logTime(log, substart, `Received responder's m2`);
    substart = Date.now();

    const {
      data: {
        customData: { signature: responderSignatureOnInitialState },
      },
    } = m2!;

    substart = Date.now();
    await assertIsValidSignature(
      getSignerAddressFromPublicIdentifier(responderIdentifier),
      setStateCommitment.hashToSign(),
      responderSignatureOnInitialState,
      `Failed to validate responders signature on initial set state commitment in the propose protocol. Our commitment: ${stringify(
        setStateCommitment.toJson(),
      )}`,
    );
    logTime(log, substart, `Asserted valid signture initiator propose`);

    // add signatures to commitment and save
    await setStateCommitment.addSignatures(
      initiatorSignatureOnInitialState as any,
      responderSignatureOnInitialState,
    );

    substart = Date.now();

    // 78 ms(!)
    yield [
      PERSIST_APP_INSTANCE,
      PersistAppType.CreateProposal,
      postProtocolStateChannel,
      appInstanceProposal,
      setStateCommitment,
    ];
    logTime(log, substart, `Persisted app instance`);
    substart = Date.now();

    // Total 298ms
    logTime(log, start, `Initiation finished`);
  },

  1 /* Responding */: async function* (context: Context) {
    const { message, store } = context;
    const log = context.log.newContext("CF-ProposeProtocol");
    const start = Date.now();
    let substart = start;
    log.info(`Response started`);

    const { params, processID } = message;

    const {
      abiEncodings,
      appDefinition,
      defaultTimeout,
      initialState,
      initiatorDeposit,
      initiatorDepositAssetId,
      initiatorIdentifier,
      meta,
      multisigAddress,
      outcomeType,
      responderDeposit,
      responderDepositAssetId,
      responderIdentifier,
      stateTimeout,
    } = params as ProtocolParams.Propose;

    const {
      customData: { signature: initiatorSignatureOnInitialState },
    } = message;

    const preProtocolStateChannel = await stateChannelClassFromStoreByMultisig(
      multisigAddress,
      store,
    );

    // 16ms
    const appInstanceProposal: AppInstanceProposal = {
      appDefinition,
      abiEncodings,
      initialState,
      outcomeType,
      identityHash: appIdentityToHash({
        appDefinition,
        channelNonce: toBN(preProtocolStateChannel.numProposedApps + 1),
        participants: preProtocolStateChannel.getSigningKeysFor(
          initiatorIdentifier,
          responderIdentifier,
        ),
        multisigAddress: preProtocolStateChannel.multisigAddress,
        defaultTimeout: toBN(defaultTimeout),
      }),
      defaultTimeout: defaultTimeout.toHexString(),
      stateTimeout: stateTimeout.toHexString(),
      initiatorDeposit: initiatorDeposit.toHexString(),
      responderDeposit: responderDeposit.toHexString(),
      initiatorIdentifier,
      responderIdentifier,
      meta,
      appSeqNo: preProtocolStateChannel.numProposedApps + 1,
      initiatorDepositAssetId: initiatorDepositAssetId || CONVENTION_FOR_ETH_ASSET_ID,
      responderDepositAssetId: responderDepositAssetId || CONVENTION_FOR_ETH_ASSET_ID,
    };

    yield [
      OP_VALIDATE,
      protocol,
      {
        proposal: appInstanceProposal,
        params,
        role: ProtocolRoles.responder,
      } as ProposeMiddlewareContext,
    ];

    const proposedAppInstance = {
      identity: {
        appDefinition,
        channelNonce: toBN(preProtocolStateChannel.numProposedApps + 1),
        participants: preProtocolStateChannel.getSigningKeysFor(
          initiatorIdentifier,
          responderIdentifier,
        ),
        multisigAddress: preProtocolStateChannel.multisigAddress,
        defaultTimeout: toBN(defaultTimeout),
      },
      hashOfLatestState: keccak256(
        defaultAbiCoder.encode([abiEncodings.stateEncoding], [initialState]),
      ),
      versionNumber: 1,
      stateTimeout: stateTimeout.toHexString(),
    };

    const setStateCommitment = getSetStateCommitment(context, proposedAppInstance as AppInstance);

    // 0ms
    const postProtocolStateChannel = preProtocolStateChannel.addProposal(appInstanceProposal);

    substart = Date.now();
    await assertIsValidSignature(
      getSignerAddressFromPublicIdentifier(initiatorIdentifier),
      setStateCommitment.hashToSign(),
      initiatorSignatureOnInitialState,
      `Failed to validate initiator's signature on initial set state commitment in the propose protocol. Our commitment: ${stringify(
        setStateCommitment.toJson(),
      )}`,
    );
    logTime(log, substart, `asserted valid signature responder propose`);

    substart = Date.now();
    // 12ms
    const responderSignatureOnInitialState = yield [OP_SIGN, setStateCommitment.hashToSign()];
    logTime(log, substart, `Signed initial state responder propose`);

    // 0ms
    yield [
      IO_SEND,
      {
        protocol,
        processID,
        seq: UNASSIGNED_SEQ_NO,
        to: initiatorIdentifier,
        customData: {
          signature: responderSignatureOnInitialState,
        },
      } as ProtocolMessageData,
    ];

    await setStateCommitment.addSignatures(
      initiatorSignatureOnInitialState,
      responderSignatureOnInitialState as any,
    );

    substart = Date.now();

    // 98ms
    // will also save the app array into the state channel
    yield [
      PERSIST_APP_INSTANCE,
      PersistAppType.CreateProposal,
      postProtocolStateChannel,
      appInstanceProposal,
      setStateCommitment,
    ];
    logTime(log, substart, `Persisted app instance`);
    substart = Date.now();
    logTime(log, start, `Response finished`);
  },
};
