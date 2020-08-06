import {
  InstallMiddlewareContext,
  Opcode,
  ProtocolNames,
  ProtocolParams,
  ProtocolRoles,
} from "@connext/types";
import {
  getAddressFromAssetId,
  getSignerAddressFromPublicIdentifier,
  logTime,
  stringify,
  toBN,
} from "@connext/utils";

import { UNASSIGNED_SEQ_NO } from "../constants";
import { getSetStateCommitment } from "../ethereum";
import { AppInstance, StateChannel, TokenIndexedCoinTransferMap } from "../models";
import { Context, PersistAppType, ProtocolExecutionFlow } from "../types";
import { assertSufficientFundsWithinFreeBalance } from "../utils";

import { assertIsValidSignature, generateProtocolMessageData, parseProtocolMessage } from "./utils";
import { NO_PROPOSED_APP_INSTANCE_FOR_APP_IDENTITY_HASH } from "../errors";

const protocol = ProtocolNames.install;
const { OP_SIGN, OP_VALIDATE, IO_SEND, IO_SEND_AND_WAIT, PERSIST_APP_INSTANCE } = Opcode;

/**
 * @description This exchange is described at the following URL:
 *
 * specs.counterfactual.com/05-install-protocol#messages
 */
export const INSTALL_PROTOCOL: ProtocolExecutionFlow = {
  /**
   * Sequence 0 of the INSTALL_PROTOCOL requires the initiator party
   * to sign the ConditionalTransactionCommitment for the as-yet un-funded
   * newly proposed AppInstance, wait for a countersignature, and then when
   * received countersign the _also received_ free balance state update to
   * activate / fund the new app, and send the signature to that back to the
   * counterparty to finish the protocol.
   *
   * @param {Context} context
   */

  0 /* Initiating */: async function* (context: Context) {
    const {
      preProtocolStateChannel,
      message: {
        data: { params, processID },
      },
      networks,
    } = context;
    const log = context.log.newContext("CF-InstallProtocol");
    const start = Date.now();
    let substart = start;
    const loggerId = (params as ProtocolParams.Install).proposal.identityHash || processID;
    log.info(`[${loggerId}] Initiation started`);
    log.debug(`[${loggerId}] Protocol initiated with parameters ${stringify(params, true, 0)}`);

    if (!preProtocolStateChannel) {
      throw new Error("No state channel found for install");
    }

    const { proposal: proposalJson, responderIdentifier } = params as ProtocolParams.Install;

    const proposal = AppInstance.fromJson(proposalJson);

    // 0ms
    assertSufficientFundsWithinFreeBalance(
      preProtocolStateChannel,
      proposal.initiatorIdentifier,
      getAddressFromAssetId(proposal.initiatorDepositAssetId),
      toBN(proposal.initiatorDeposit),
    );

    // 0ms
    assertSufficientFundsWithinFreeBalance(
      preProtocolStateChannel,
      proposal.responderIdentifier,
      getAddressFromAssetId(proposal.responderDepositAssetId),
      toBN(proposal.responderDeposit),
    );

    const stateChannelAfter = computeInstallStateChannelTransition(
      preProtocolStateChannel,
      proposal,
    );

    const newAppInstance = stateChannelAfter.getAppInstance(proposal.identityHash);

    // safe to do here, nothing is signed or written to store
    const error = yield [
      OP_VALIDATE,
      protocol,
      {
        params,
        stateChannel: preProtocolStateChannel.toJson(),
        appInstance: newAppInstance.toJson(),
        role: ProtocolRoles.initiator,
      } as InstallMiddlewareContext,
    ];
    if (!!error) {
      throw new Error(error);
    }
    logTime(log, substart, `[${loggerId}] Validated app ${newAppInstance.identityHash}`);
    substart = Date.now();

    const freeBalanceUpdateData = getSetStateCommitment(
      networks[stateChannelAfter.chainId],
      stateChannelAfter.freeBalance,
    );
    const freeBalanceUpdateDataHash = freeBalanceUpdateData.hashToSign();

    // 12ms
    // always use free balance key to sign free balance update
    const mySignatureOnFreeBalanceStateUpdate = yield [OP_SIGN, freeBalanceUpdateDataHash];

    // 124ms
    const { message: m2 } = yield [
      IO_SEND_AND_WAIT,
      generateProtocolMessageData(responderIdentifier, protocol, processID, 1, params!, {
        customData: { signature: mySignatureOnFreeBalanceStateUpdate },
        prevMessageReceived: start,
      }),
    ];
    const {
      data: {
        customData: { signature: counterpartySignatureOnFreeBalanceStateUpdate },
      },
    } = parseProtocolMessage(m2);

    // 7ms
    // free balance addr signs conditional transactions
    substart = Date.now();

    // 0ms
    const responderSignerAddress = getSignerAddressFromPublicIdentifier(responderIdentifier);

    // 7ms
    // always use free balance key to sign free balance update
    await assertIsValidSignature(
      responderSignerAddress,
      freeBalanceUpdateDataHash,
      counterpartySignatureOnFreeBalanceStateUpdate,
      `Failed to validate responders signature on free balance update in the install protocol. Our commitment: ${stringify(
        freeBalanceUpdateData.toJson(),
        true,
        0,
      )}`,
    );
    logTime(log, substart, `[${loggerId}] Verified responder's sig on free balance update`);
    substart = Date.now();

    await freeBalanceUpdateData.addSignatures(
      counterpartySignatureOnFreeBalanceStateUpdate,
      mySignatureOnFreeBalanceStateUpdate,
    );

    yield [
      PERSIST_APP_INSTANCE,
      PersistAppType.CreateInstance,
      stateChannelAfter,
      newAppInstance,
      freeBalanceUpdateData,
    ];

    // 335ms
    logTime(log, start, `[${loggerId}] Initiation finished`);
  } as any,

  /**
   * Sequence 1 of the INSTALL_PROTOCOL requires the responder party
   * to countersignsign the ConditionalTransactionCommitment and then sign
   * the update to the free balance object, wait for the intitiating party to
   * sign _that_ and then finish the protocol.
   *
   * @param {Context} context
   */

  1 /* Responding */: async function* (context: Context) {
    const {
      message: {
        data: {
          params,
          processID,
          customData: { signature },
        },
      },
      preProtocolStateChannel,
      networks,
    } = context;
    const log = context.log.newContext("CF-InstallProtocol");
    const start = Date.now();
    let substart = start;
    const { proposal: proposalJson, initiatorIdentifier } =
      (params as ProtocolParams.Install) || {};
    const loggerId = proposalJson?.identityHash || processID;
    log.info(`[${loggerId}] Response started`);
    log.debug(
      `[${loggerId}] Protocol response started with parameters ${stringify(params, true, 0)}`,
    );

    // Aliasing `signature` to this variable name for code clarity
    const counterpartySignatureOnFreeBalanceStateUpdate = signature;

    if (!preProtocolStateChannel) {
      throw new Error("No state channel found for install");
    }

    const proposal = AppInstance.fromJson(proposalJson);

    // 0ms
    assertSufficientFundsWithinFreeBalance(
      preProtocolStateChannel,
      proposal.initiatorIdentifier,
      getAddressFromAssetId(proposal.initiatorDepositAssetId),
      toBN(proposal.initiatorDeposit),
    );

    // 0ms
    assertSufficientFundsWithinFreeBalance(
      preProtocolStateChannel,
      proposal.responderIdentifier,
      getAddressFromAssetId(proposal.responderDepositAssetId),
      toBN(proposal.responderDeposit),
    );

    const stateChannelAfter = computeInstallStateChannelTransition(
      preProtocolStateChannel,
      proposal,
    );

    const newAppInstance = stateChannelAfter.getAppInstance(proposal.identityHash);

    // safe to do here, nothing is signed or written to store
    const error = yield [
      OP_VALIDATE,
      protocol,
      {
        params,
        stateChannel: preProtocolStateChannel.toJson(),
        appInstance: newAppInstance.toJson(),
        role: ProtocolRoles.responder,
      } as InstallMiddlewareContext,
    ];
    if (!!error) {
      throw new Error(error);
    }
    logTime(log, substart, `[${loggerId}] Validated app ${newAppInstance.identityHash}`);
    substart = Date.now();

    // 7ms
    // multisig owner always signs conditional tx
    const protocolInitiatorAddr = getSignerAddressFromPublicIdentifier(initiatorIdentifier);
    const freeBalanceUpdateData = getSetStateCommitment(
      networks[stateChannelAfter.chainId],
      stateChannelAfter.freeBalance,
    );
    const freeBalanceUpdateDataHash = freeBalanceUpdateData.hashToSign();
    await assertIsValidSignature(
      protocolInitiatorAddr,
      freeBalanceUpdateDataHash,
      counterpartySignatureOnFreeBalanceStateUpdate,
      `Failed to validate initiators signature on conditional transaction commitment in the install protocol. Our commitment: ${stringify(
        freeBalanceUpdateData.toJson(),
        true,
        0,
      )}`,
    );
    logTime(log, substart, `[${loggerId}] Verified initiator's free balance update sig`);
    substart = Date.now();

    const mySignatureOnFreeBalanceStateUpdate = yield [OP_SIGN, freeBalanceUpdateDataHash];

    // add signature
    await freeBalanceUpdateData.addSignatures(
      counterpartySignatureOnFreeBalanceStateUpdate,
      mySignatureOnFreeBalanceStateUpdate,
    );

    // 13ms
    yield [
      PERSIST_APP_INSTANCE,
      PersistAppType.CreateInstance,
      stateChannelAfter,
      newAppInstance,
      freeBalanceUpdateData,
    ];
    logTime(log, substart, `[${loggerId}] Persisted app ${newAppInstance.identityHash}`);
    substart = Date.now();

    // 154ms
    yield [
      IO_SEND,
      generateProtocolMessageData(
        initiatorIdentifier,
        protocol,
        processID,
        UNASSIGNED_SEQ_NO,
        params!,
        {
          customData: { signature: mySignatureOnFreeBalanceStateUpdate },
          prevMessageReceived: start,
        },
      ),
      stateChannelAfter,
      newAppInstance,
    ] as any;

    // 272ms
    logTime(log, start, `[${loggerId}] Response finished`);
  } as any,
};

/**
 * Generates the would-be new StateChannel to represent the final state of the
 * StateChannel after the protocol would be executed with correct signatures.
 *
 * @param {StateChannel} stateChannel - The pre-protocol state of the channel
 * @returns {Promise<StateChannel>} - The post-protocol state of the channel
 */
export function computeInstallStateChannelTransition(
  stateChannel: StateChannel,
  proposal: AppInstance,
): StateChannel {
  // Verify that the proposal exists in the channel
  const stored = stateChannel.proposedAppInstances.get(proposal.identityHash);

  if (!stored) {
    throw new Error(NO_PROPOSED_APP_INSTANCE_FOR_APP_IDENTITY_HASH(proposal.identityHash));
  }
  return stateChannel.installApp(
    proposal,
    getTokenBalanceDecrementForInstall(stateChannel, proposal),
  );
}

export function getTokenBalanceDecrementForInstall(
  stateChannel: StateChannel,
  proposal: AppInstance,
): TokenIndexedCoinTransferMap {
  const appInitiatorToken = getAddressFromAssetId(proposal.initiatorDepositAssetId);
  const appResponderToken = getAddressFromAssetId(proposal.responderDepositAssetId);

  const appInitiatorFb = getSignerAddressFromPublicIdentifier(proposal.initiatorIdentifier);
  const appResponderFb = getSignerAddressFromPublicIdentifier(proposal.responderIdentifier);
  const sameChannelAndAppOrdering = appInitiatorFb === stateChannel.multisigOwners[0];

  let tokenIndexedBalanceDecrement: TokenIndexedCoinTransferMap;
  if (appInitiatorToken !== appResponderToken) {
    tokenIndexedBalanceDecrement = {
      [appInitiatorToken]: {
        [appInitiatorFb]: toBN(proposal.initiatorDeposit),
      },
      [appResponderToken]: {
        [appResponderFb]: toBN(proposal.responderDeposit),
      },
    };
  } else {
    // If the decrements are on the same token, the previous block
    // sets the decrement only on the `respondingFbAddress` and the
    // `initiatingFbAddress` would get overwritten
    tokenIndexedBalanceDecrement = {
      [appResponderToken]: {
        [stateChannel.multisigOwners[0]]: sameChannelAndAppOrdering
          ? toBN(proposal.initiatorDeposit)
          : toBN(proposal.responderDeposit),
        [stateChannel.multisigOwners[1]]: sameChannelAndAppOrdering
          ? toBN(proposal.responderDeposit)
          : toBN(proposal.initiatorDeposit),
      },
    };
  }

  return tokenIndexedBalanceDecrement;
}
