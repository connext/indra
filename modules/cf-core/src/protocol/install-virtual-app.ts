/* eslint-disable require-yield */
import { MaxUint256 } from "ethers/constants";
import { BaseProvider } from "ethers/providers";
import { BigNumber, bigNumberify, defaultAbiCoder } from "ethers/utils";

import { ConditionalTransactionCommitment, SetStateCommitment } from "../ethereum";
import { Opcode, Protocol, sortAddresses, xkeyKthAddress, Commitment } from "../machine";
import { AppInstance, StateChannel } from "../models";
import { Store } from "../store";
import {
  Context,
  InstallVirtualAppProtocolParams,
  MultiAssetMultiPartyCoinTransferInterpreterParams,
  NetworkContext,
  OutcomeType,
  ProtocolExecutionFlow,
  ProtocolMessage,
  SingleAssetTwoPartyCoinTransferInterpreterParams,
  TwoPartyFixedOutcomeInterpreterParams,
  virtualAppAgreementEncoding,
} from "../types";
import { assertSufficientFundsWithinFreeBalance } from "../utils";

import { assertIsValidSignature, UNASSIGNED_SEQ_NO } from "./utils";

export const encodeSingleAssetTwoPartyIntermediaryAgreementParams = params =>
  defaultAbiCoder.encode([virtualAppAgreementEncoding], [params]);

/**
 * File notes:
 *
 * FIXME: This file over-uses the xkeyKthAddress function which
 *        is quite computationally expensive. Refactor to use it less.
 *
 * FIXME: Need to verify the proper private key is being used in signing
 *        here
 *
 * FIXME: Need to make adjustments to the `propose` protocol to allow for
 *        the intermediary to refuse to support a virtual app (rn they only
 *        find out in a meaningful way through the `INSTALL_VIRTUAL_EVENT`
 *        triggered at the end of the protocol, or parsing every protocol
 *        message and trying to stop a protocol mid-execution)
 */

const protocol = Protocol.InstallVirtualApp;

const { OP_SIGN, WRITE_COMMITMENT, IO_SEND, IO_SEND_AND_WAIT, PERSIST_STATE_CHANNEL } = Opcode;

const { Conditional, SetState } = Commitment;

/**
 * This exchange is described at the following URL:
 *
 * https://specs.counterfactual.com/en/latest/protocols/install-virtual-app.html
 */
export const INSTALL_VIRTUAL_APP_PROTOCOL: ProtocolExecutionFlow = {
  0 /* Initiating */: async function*(context: Context) {
    throw Error(`Virtual app protocols not supported.`);
    /**
    const {
      message: { params, processID },
      store,
      network,
      provider,
    } = context;

    const { intermediaryXpub, responderXpub } = params as InstallVirtualAppProtocolParams;

    const [
      stateChannelWithRespondingAndIntermediary,
      stateChannelWithResponding,
      stateChannelWithIntermediary,
      virtualAppInstance,
      timeLockedPassThroughAppInstance,
    ] = await getUpdatedStateChannelAndVirtualAppObjectsForInitiating(
      params as InstallVirtualAppProtocolParams,
      store,
      network,
      provider,
    );

    // get all signing addresses
    const intermediaryFreeBalanceAddress = stateChannelWithIntermediary.getMultisigOwnerAddrOf(
      intermediaryXpub,
    );
    const intermediaryEphemeralAddress = xkeyKthAddress(
      intermediaryXpub,
      virtualAppInstance.appSeqNo,
    );

    const responderFreeBalanceAddress = stateChannelWithResponding.getMultisigOwnerAddrOf(
      responderXpub,
    );
    const responderEphemeralAddress = xkeyKthAddress(responderXpub, virtualAppInstance.appSeqNo);

    const presignedMultisigTxForAliceIngridVirtualAppAgreement = new ConditionalTransactionCommitment(
      network,
      stateChannelWithIntermediary.multisigAddress,
      stateChannelWithIntermediary.multisigOwners,
      timeLockedPassThroughAppInstance.identityHash,
      stateChannelWithIntermediary.freeBalance.identityHash,
      network.TwoPartyFixedOutcomeFromVirtualAppInterpreter,
      encodeSingleAssetTwoPartyIntermediaryAgreementParams(
        stateChannelWithIntermediary.getSingleAssetTwoPartyIntermediaryAgreementFromVirtualApp(
          virtualAppInstance.identityHash,
        ),
      ),
    );

    const initiatorSignatureOnAliceIngridVirtualAppAgreement = yield [
      OP_SIGN,
      presignedMultisigTxForAliceIngridVirtualAppAgreement,
      virtualAppInstance.appSeqNo,
    ];

    const m1 = {
      params, // Must include as this is the first message received by intermediary
      protocol,
      processID,
      toXpub: intermediaryXpub,
      seq: 1,
      customData: {
        signature: initiatorSignatureOnAliceIngridVirtualAppAgreement,
        // FIXME: We are abusing these typed parameters in the ProtocolMessage
        //        to pass through some variables from the initiating party
        //        to the intermediary party. To fix, we ought to have some
        //        kind of `metadata` fields on the ProtocolMessage
        signature2: virtualAppInstance.identityHash,
        signature3: timeLockedPassThroughAppInstance.state["defaultOutcome"],
      },
    } as ProtocolMessage;

    const m4 = ((yield [IO_SEND_AND_WAIT, m1]) as unknown) as ProtocolMessage;

    const {
      customData: {
        signature: intermediarySignatureOnAliceIngridVirtualAppAgreement,
        signature2: intermediarySignatureOnAliceIngridFreeBalanceAppActivation,
      },
    } = m4;

    // TODO: who signs a conditional tx?
    assertIsValidSignature(
      intermediaryEphemeralAddress,
      presignedMultisigTxForAliceIngridVirtualAppAgreement,
      intermediarySignatureOnAliceIngridVirtualAppAgreement,
    );

    presignedMultisigTxForAliceIngridVirtualAppAgreement.signatures = [
      initiatorSignatureOnAliceIngridVirtualAppAgreement,
      intermediarySignatureOnAliceIngridVirtualAppAgreement,
    ];

    yield [
      WRITE_COMMITMENT,
      Conditional, // TODO: Figure out how to map this to save to DB correctly
      presignedMultisigTxForAliceIngridVirtualAppAgreement,
      virtualAppInstance.identityHash,
    ];

    const freeBalanceAliceIngridVirtualAppAgreementActivationCommitment = new SetStateCommitment(
      network.ChallengeRegistry,
      stateChannelWithIntermediary.freeBalance.identity,
      stateChannelWithIntermediary.freeBalance.hashOfLatestState,
      stateChannelWithIntermediary.freeBalance.versionNumber,
      stateChannelWithIntermediary.freeBalance.timeout,
    );

    // always use free balance address when signing free balance
    // updates
    assertIsValidSignature(
      intermediaryFreeBalanceAddress,
      freeBalanceAliceIngridVirtualAppAgreementActivationCommitment,
      intermediarySignatureOnAliceIngridFreeBalanceAppActivation,
    );

    // always use free balance address when signing free balance
    // updates
    const initiatorSignatureOnAliceIngridFreeBalanceAppActivation = yield [
      OP_SIGN,
      freeBalanceAliceIngridVirtualAppAgreementActivationCommitment,
    ];
    freeBalanceAliceIngridVirtualAppAgreementActivationCommitment.signatures = [
      initiatorSignatureOnAliceIngridFreeBalanceAppActivation,
      intermediarySignatureOnAliceIngridFreeBalanceAppActivation,
    ];

    yield [
      WRITE_COMMITMENT,
      SetState,
      freeBalanceAliceIngridVirtualAppAgreementActivationCommitment,
      stateChannelWithIntermediary.freeBalance.identityHash,
    ];

    const virtualAppSetStateCommitment = new SetStateCommitment(
      network.ChallengeRegistry,
      virtualAppInstance.identity,
      virtualAppInstance.hashOfLatestState,
      virtualAppInstance.versionNumber,
      virtualAppInstance.defaultTimeout,
    );

    const timeLockedPassThroughSetStateCommitment = new SetStateCommitment(
      network.ChallengeRegistry,
      timeLockedPassThroughAppInstance.identity,
      timeLockedPassThroughAppInstance.hashOfLatestState,
      timeLockedPassThroughAppInstance.versionNumber,
      timeLockedPassThroughAppInstance.defaultTimeout,
    );

    // TODO: who signs time locked pass through app?
    const initiatorSignatureOnTimeLockedPassThroughSetStateCommitment = yield [
      OP_SIGN,
      timeLockedPassThroughSetStateCommitment,
      timeLockedPassThroughAppInstance.appSeqNo,
    ];

    const initiatorSignatureOnVirtualAppSetStateCommitment = yield [
      OP_SIGN,
      virtualAppSetStateCommitment,
      virtualAppInstance.appSeqNo,
    ];

    const m5 = {
      protocol,
      processID,
      toXpub: intermediaryXpub,
      seq: UNASSIGNED_SEQ_NO,
      customData: {
        signature: initiatorSignatureOnAliceIngridFreeBalanceAppActivation,
        signature2: initiatorSignatureOnTimeLockedPassThroughSetStateCommitment,
        signature3: initiatorSignatureOnVirtualAppSetStateCommitment,
      },
    } as ProtocolMessage;

    const m8 = ((yield [IO_SEND_AND_WAIT, m5]) as unknown) as ProtocolMessage;

    const {
      customData: {
        signature: intermediarySignatureOnTimeLockedPassThroughSetStateCommitment,
        signature2: responderSignatureOnTimeLockedPassThroughSetStateCommitment,
        signature3: responderSignatureOnVirtualAppSetStateCommitment,
      },
    } = m8;

    // TODO: who signs time locked pass through app?
    assertIsValidSignature(
      intermediaryEphemeralAddress,
      timeLockedPassThroughSetStateCommitment,
      intermediarySignatureOnTimeLockedPassThroughSetStateCommitment,
    );

    // TODO: who signs time locked pass through app?
    assertIsValidSignature(
      responderEphemeralAddress,
      timeLockedPassThroughSetStateCommitment,
      responderSignatureOnTimeLockedPassThroughSetStateCommitment,
    );

    assertIsValidSignature(
      responderEphemeralAddress,
      virtualAppSetStateCommitment,
      responderSignatureOnVirtualAppSetStateCommitment,
    );

    timeLockedPassThroughSetStateCommitment.signatures = [
      initiatorSignatureOnTimeLockedPassThroughSetStateCommitment,
      responderSignatureOnTimeLockedPassThroughSetStateCommitment,
      intermediarySignatureOnTimeLockedPassThroughSetStateCommitment,
    ];

    yield [
      WRITE_COMMITMENT,
      SetState,
      timeLockedPassThroughSetStateCommitment,
      timeLockedPassThroughAppInstance.identityHash,
    ];

    virtualAppSetStateCommitment.signatures = [
      initiatorSignatureOnVirtualAppSetStateCommitment,
      responderSignatureOnVirtualAppSetStateCommitment,
    ];

    yield [
      WRITE_COMMITMENT,
      SetState,
      virtualAppSetStateCommitment,
      virtualAppInstance.identityHash,
    ];

    yield [
      PERSIST_STATE_CHANNEL,
      [
        stateChannelWithIntermediary,
        stateChannelWithResponding,
        stateChannelWithRespondingAndIntermediary,
      ],
    ];
    */
  },

  1 /* Intermediary */: async function*(context: Context) {
    throw Error(`Virtual app protocols not supported.`);
    /**
    const { message: m1, store, network } = context;

    const {
      params,
      processID,
      customData: {
        signature: initiatorSignatureOnAliceIngridVirtualAppAgreement,
        // FIXME: We are abusing these typed parameters in the ProtocolMessage
        //        to pass through some variables from the initiating party
        //        to the intermediary party. To fix, we ought to have some
        //        kind of `metadata` fields on the ProtocolMessage
        signature2: virtualAppInstanceIdentityHash,
        signature3: virtualAppInstanceDefaultOutcome,
      },
    } = m1;

    const { initiatorXpub, responderXpub } = params as InstallVirtualAppProtocolParams;

    const [
      stateChannelBetweenVirtualAppUsers,
      stateChannelWithInitiating,
      stateChannelWithResponding,
      timeLockedPassThroughAppInstance,
    ] = await getUpdatedStateChannelAndVirtualAppObjectsForIntermediary(
      params as InstallVirtualAppProtocolParams,
      store,
      (virtualAppInstanceIdentityHash as unknown) as string,
      (virtualAppInstanceDefaultOutcome as unknown) as string,
      network,
    );

    const initiatorFreeBalanceAddress = stateChannelWithInitiating.getMultisigOwnerAddrOf(
      initiatorXpub,
    );
    const initiatorEphemeralAddress = xkeyKthAddress(
      initiatorXpub,
      timeLockedPassThroughAppInstance.appSeqNo,
    );

    const responderFreeBalanceAddress = stateChannelWithResponding.getMultisigOwnerAddrOf(
      responderXpub,
    );
    const responderEphemeralAddress = xkeyKthAddress(
      responderXpub,
      timeLockedPassThroughAppInstance.appSeqNo,
    );

    const presignedMultisigTxForAliceIngridVirtualAppAgreement = new ConditionalTransactionCommitment(
      network,
      stateChannelWithInitiating.multisigAddress,
      stateChannelWithInitiating.multisigOwners,
      timeLockedPassThroughAppInstance.identityHash,
      stateChannelWithInitiating.freeBalance.identityHash,
      network.TwoPartyFixedOutcomeFromVirtualAppInterpreter,
      encodeSingleAssetTwoPartyIntermediaryAgreementParams(
        stateChannelWithInitiating.getSingleAssetTwoPartyIntermediaryAgreementFromVirtualApp(
          timeLockedPassThroughAppInstance.state["targetAppIdentityHash"],
        ),
      ),
    );

    // TODO: who signs conditional txs?
    assertIsValidSignature(
      initiatorEphemeralAddress,
      presignedMultisigTxForAliceIngridVirtualAppAgreement,
      initiatorSignatureOnAliceIngridVirtualAppAgreement,
    );

    const presignedMultisigTxForIngridBobVirtualAppAgreement = new ConditionalTransactionCommitment(
      network,
      stateChannelWithResponding.multisigAddress,
      stateChannelWithResponding.multisigOwners,
      timeLockedPassThroughAppInstance.identityHash,
      stateChannelWithResponding.freeBalance.identityHash,
      network.TwoPartyFixedOutcomeFromVirtualAppInterpreter,
      encodeSingleAssetTwoPartyIntermediaryAgreementParams(
        stateChannelWithResponding.getSingleAssetTwoPartyIntermediaryAgreementFromVirtualApp(
          timeLockedPassThroughAppInstance.state["targetAppIdentityHash"],
        ),
      ),
    );

    // TODO: who signs conditional txs?
    const intermediarySignatureOnIngridBobVirtualAppAgreement = yield [
      OP_SIGN,
      presignedMultisigTxForIngridBobVirtualAppAgreement,
      timeLockedPassThroughAppInstance.appSeqNo,
    ];

    const m2 = {
      params, // Must include as this is the first message received by responder
      protocol,
      processID,
      seq: 2,
      toXpub: responderXpub,
      customData: {
        signature: intermediarySignatureOnIngridBobVirtualAppAgreement,
      },
    } as ProtocolMessage;

    const m3 = ((yield [IO_SEND_AND_WAIT, m2]) as unknown) as ProtocolMessage;

    const {
      customData: {
        signature: responderSignatureOnIngridBobVirtualAppAgreement,
        signature2: responderSignatureOnIngridBobFreeBalanceAppActivation,
      },
    } = m3;

    // TODO: who signs conditional txs?
    assertIsValidSignature(
      responderEphemeralAddress,
      presignedMultisigTxForIngridBobVirtualAppAgreement,
      responderSignatureOnIngridBobVirtualAppAgreement,
    );

    const freeBalanceIngridBobVirtualAppAgreementActivationCommitment = new SetStateCommitment(
      network.ChallengeRegistry,
      stateChannelWithResponding.freeBalance.identity,
      stateChannelWithResponding.freeBalance.hashOfLatestState,
      stateChannelWithResponding.freeBalance.versionNumber,
      stateChannelWithResponding.freeBalance.timeout,
    );

    // free balance address always signs fb app
    assertIsValidSignature(
      responderFreeBalanceAddress,
      freeBalanceIngridBobVirtualAppAgreementActivationCommitment,
      responderSignatureOnIngridBobFreeBalanceAppActivation,
    );

    const freeBalanceAliceIngridVirtualAppAgreementActivationCommitment = new SetStateCommitment(
      network.ChallengeRegistry,
      stateChannelWithInitiating.freeBalance.identity,
      stateChannelWithInitiating.freeBalance.hashOfLatestState,
      stateChannelWithInitiating.freeBalance.versionNumber,
      stateChannelWithInitiating.freeBalance.timeout,
    );

    // free balance address always signs fb app
    const intermediarySignatureOnAliceIngridFreeBalanceAppActivation = yield [
      OP_SIGN,
      freeBalanceAliceIngridVirtualAppAgreementActivationCommitment,
    ];

    const intermediarySignatureOnAliceIngridVirtualAppAgreement = yield [
      OP_SIGN,
      presignedMultisigTxForAliceIngridVirtualAppAgreement,
      timeLockedPassThroughAppInstance.appSeqNo,
    ];

    presignedMultisigTxForAliceIngridVirtualAppAgreement.signatures = [
      initiatorSignatureOnAliceIngridVirtualAppAgreement,
      intermediarySignatureOnAliceIngridVirtualAppAgreement,
    ];

    yield [
      WRITE_COMMITMENT,
      Conditional,
      presignedMultisigTxForAliceIngridVirtualAppAgreement,
      timeLockedPassThroughAppInstance.identityHash,
    ];

    const m4 = {
      protocol,
      processID,
      seq: UNASSIGNED_SEQ_NO,
      toXpub: initiatorXpub,
      customData: {
        signature: intermediarySignatureOnAliceIngridVirtualAppAgreement,
        signature2: intermediarySignatureOnAliceIngridFreeBalanceAppActivation,
      },
    } as ProtocolMessage;

    const m5 = ((yield [IO_SEND_AND_WAIT, m4]) as unknown) as ProtocolMessage;

    const {
      customData: {
        signature: initiatorSignatureOnAliceIngridFreeBalanceAppActivation,
        signature2: initiatorSignatureOnTimeLockedPassThroughSetStateCommitment,
        signature3: initiatorSignatureOnVirtualAppSetStateCommitment,
      },
    } = m5;

    // free balance address always signs fb app
    assertIsValidSignature(
      initiatorFreeBalanceAddress,
      freeBalanceAliceIngridVirtualAppAgreementActivationCommitment,
      initiatorSignatureOnAliceIngridFreeBalanceAppActivation,
    );
    freeBalanceIngridBobVirtualAppAgreementActivationCommitment.signatures = [
      initiatorSignatureOnAliceIngridFreeBalanceAppActivation,
      intermediarySignatureOnAliceIngridFreeBalanceAppActivation,
    ];

    yield [
      WRITE_COMMITMENT,
      SetState,
      freeBalanceIngridBobVirtualAppAgreementActivationCommitment,
      stateChannelWithResponding.freeBalance.identityHash,
    ];

    const timeLockedPassThroughSetStateCommitment = new SetStateCommitment(
      network.ChallengeRegistry,
      timeLockedPassThroughAppInstance.identity,
      timeLockedPassThroughAppInstance.hashOfLatestState,
      timeLockedPassThroughAppInstance.versionNumber,
      timeLockedPassThroughAppInstance.defaultTimeout,
    );

    assertIsValidSignature(
      initiatorEphemeralAddress,
      timeLockedPassThroughSetStateCommitment,
      initiatorSignatureOnTimeLockedPassThroughSetStateCommitment,
    );

    const intermediarySignatureOnIngridBobFreeBalanceAppActivation = yield [
      OP_SIGN,
      freeBalanceIngridBobVirtualAppAgreementActivationCommitment,
    ];

    freeBalanceIngridBobVirtualAppAgreementActivationCommitment.signatures = [
      responderSignatureOnIngridBobFreeBalanceAppActivation,
      intermediarySignatureOnIngridBobFreeBalanceAppActivation,
    ];

    yield [
      WRITE_COMMITMENT,
      SetState,
      freeBalanceIngridBobVirtualAppAgreementActivationCommitment,
      stateChannelWithResponding.freeBalance.identityHash,
    ];

    const intermediarySignatureOnTimeLockedPassThroughSetStateCommitment = yield [
      OP_SIGN,
      timeLockedPassThroughSetStateCommitment,
      timeLockedPassThroughAppInstance.appSeqNo,
    ];

    const m6 = {
      protocol,
      processID,
      toXpub: responderXpub,
      seq: UNASSIGNED_SEQ_NO,
      customData: {
        signature: intermediarySignatureOnIngridBobFreeBalanceAppActivation,
        signature2: intermediarySignatureOnTimeLockedPassThroughSetStateCommitment,
        signature3: initiatorSignatureOnTimeLockedPassThroughSetStateCommitment,
        signature4: initiatorSignatureOnVirtualAppSetStateCommitment,
      },
    } as ProtocolMessage;

    const m7 = ((yield [IO_SEND_AND_WAIT, m6]) as unknown) as ProtocolMessage;

    const {
      customData: {
        signature: responderSignatureOnTimeLockedPassThroughSetStateCommitment,
        signature2: responderSignatureOnVirtualAppSetStateCommitment,
      },
    } = m7;

    assertIsValidSignature(
      responderEphemeralAddress,
      timeLockedPassThroughSetStateCommitment,
      responderSignatureOnTimeLockedPassThroughSetStateCommitment,
    );

    timeLockedPassThroughSetStateCommitment.signatures = [
      initiatorSignatureOnTimeLockedPassThroughSetStateCommitment,
      responderSignatureOnTimeLockedPassThroughSetStateCommitment,
      intermediarySignatureOnTimeLockedPassThroughSetStateCommitment,
    ];

    yield [
      WRITE_COMMITMENT,
      SetState,
      timeLockedPassThroughSetStateCommitment,
      timeLockedPassThroughAppInstance.identityHash,
    ];

    const m8 = {
      protocol,
      processID,
      toXpub: initiatorXpub,
      seq: UNASSIGNED_SEQ_NO,
      customData: {
        signature: intermediarySignatureOnTimeLockedPassThroughSetStateCommitment,
        signature2: responderSignatureOnTimeLockedPassThroughSetStateCommitment,
        signature3: responderSignatureOnVirtualAppSetStateCommitment,
      },
    } as ProtocolMessage;

    yield [IO_SEND, m8];

    yield [
      PERSIST_STATE_CHANNEL,
      [stateChannelBetweenVirtualAppUsers, stateChannelWithResponding, stateChannelWithInitiating],
    ];
    */
  },

  2 /* Responding */: async function*(context: Context) {
    throw Error(`Virtual app protocols not supported.`);
    /**
    const { message: m2, store, network, provider } = context;

    const {
      params,
      processID,
      customData: { signature: intermediarySignatureOnIngridBobVirtualAppAgreement },
    } = m2;

    const { intermediaryXpub, initiatorXpub } = params as InstallVirtualAppProtocolParams;

    const [
      stateChannelWithRespondingAndIntermediary,
      stateChannelWithInitiating,
      stateChannelWithIntermediary,
      virtualAppInstance,
      timeLockedPassThroughAppInstance,
    ] = await getUpdatedStateChannelAndVirtualAppObjectsForResponding(
      params as InstallVirtualAppProtocolParams,
      store,
      network,
      provider,
    );

    const intermediaryFreeBalanceAddress = stateChannelWithIntermediary.getMultisigOwnerAddrOf(
      intermediaryXpub,
    );
    const intermediaryEphemeralAddress = xkeyKthAddress(
      intermediaryXpub,
      virtualAppInstance.appSeqNo,
    );

    const initiatorFreeBalanceAddress = stateChannelWithInitiating.getMultisigOwnerAddrOf(
      initiatorXpub,
    );
    const initiatorEphemeralAddress = xkeyKthAddress(initiatorXpub, virtualAppInstance.appSeqNo);

    const presignedMultisigTxForIngridBobVirtualAppAgreement = new ConditionalTransactionCommitment(
      network,
      stateChannelWithIntermediary.multisigAddress,
      stateChannelWithIntermediary.multisigOwners,
      timeLockedPassThroughAppInstance.identityHash,
      stateChannelWithIntermediary.freeBalance.identityHash,
      network.TwoPartyFixedOutcomeFromVirtualAppInterpreter,
      encodeSingleAssetTwoPartyIntermediaryAgreementParams(
        stateChannelWithIntermediary.getSingleAssetTwoPartyIntermediaryAgreementFromVirtualApp(
          virtualAppInstance.identityHash,
        ),
      ),
    );

    // TODO: who signs conditional txs?
    assertIsValidSignature(
      intermediaryEphemeralAddress,
      presignedMultisigTxForIngridBobVirtualAppAgreement,
      intermediarySignatureOnIngridBobVirtualAppAgreement,
    );

    // TODO: who signs conditional txs?
    const responderSignatureOnIngridBobVirtualAppAgreement = yield [
      OP_SIGN,
      presignedMultisigTxForIngridBobVirtualAppAgreement,
      virtualAppInstance.appSeqNo,
    ];

    presignedMultisigTxForIngridBobVirtualAppAgreement.signatures = [
      responderSignatureOnIngridBobVirtualAppAgreement,
      intermediarySignatureOnIngridBobVirtualAppAgreement,
    ];

    yield [
      WRITE_COMMITMENT,
      Conditional, // TODO: Figure out how to map this to save to DB correctly
      presignedMultisigTxForIngridBobVirtualAppAgreement,
      virtualAppInstance.identityHash,
    ];

    const freeBalanceIngridBobVirtualAppAgreementActivationCommitment = new SetStateCommitment(
      network.ChallengeRegistry,
      stateChannelWithIntermediary.freeBalance.identity,
      stateChannelWithIntermediary.freeBalance.hashOfLatestState,
      stateChannelWithIntermediary.freeBalance.versionNumber,
      stateChannelWithIntermediary.freeBalance.timeout,
    );

    // always use free balance addr for fb app
    const responderSignatureOnIngridBobFreeBalanceAppActivation = yield [
      OP_SIGN,
      freeBalanceIngridBobVirtualAppAgreementActivationCommitment,
    ];

    const m3 = {
      protocol,
      processID,
      toXpub: intermediaryXpub,
      seq: UNASSIGNED_SEQ_NO,
      customData: {
        signature: responderSignatureOnIngridBobVirtualAppAgreement,
        signature2: responderSignatureOnIngridBobFreeBalanceAppActivation,
      },
    } as ProtocolMessage;

    const m6 = ((yield [IO_SEND_AND_WAIT, m3]) as unknown) as ProtocolMessage;

    const {
      customData: {
        signature: intermediarySignatureOnIngridBobFreeBalanceAppActivation,
        signature2: intermediarySignatureOnTimeLockedPassThroughSetStateCommitment,
        signature3: initiatorSignatureOnTimeLockedPassThroughSetStateCommitment,
        signature4: initiatorSignatureOnVirtualAppSetStateCommitment,
      },
    } = m6;

    // always use free balance addr for fb app
    assertIsValidSignature(
      intermediaryFreeBalanceAddress,
      freeBalanceIngridBobVirtualAppAgreementActivationCommitment,
      intermediarySignatureOnIngridBobFreeBalanceAppActivation,
    );

    freeBalanceIngridBobVirtualAppAgreementActivationCommitment.signatures = [
      intermediarySignatureOnIngridBobFreeBalanceAppActivation,
      responderSignatureOnIngridBobFreeBalanceAppActivation,
    ];

    yield [
      WRITE_COMMITMENT,
      SetState,
      freeBalanceIngridBobVirtualAppAgreementActivationCommitment,
      stateChannelWithIntermediary.freeBalance.identityHash,
    ];

    const virtualAppSetStateCommitment = new SetStateCommitment(
      network.ChallengeRegistry,
      virtualAppInstance.identity,
      virtualAppInstance.hashOfLatestState,
      virtualAppInstance.versionNumber,
      virtualAppInstance.defaultTimeout,
    );

    const timeLockedPassThroughSetStateCommitment = new SetStateCommitment(
      network.ChallengeRegistry,
      timeLockedPassThroughAppInstance.identity,
      timeLockedPassThroughAppInstance.hashOfLatestState,
      timeLockedPassThroughAppInstance.versionNumber,
      timeLockedPassThroughAppInstance.defaultTimeout,
    );

    assertIsValidSignature(
      intermediaryEphemeralAddress,
      timeLockedPassThroughSetStateCommitment,
      intermediarySignatureOnTimeLockedPassThroughSetStateCommitment,
    );

    assertIsValidSignature(
      initiatorEphemeralAddress,
      timeLockedPassThroughSetStateCommitment,
      initiatorSignatureOnTimeLockedPassThroughSetStateCommitment,
    );

    assertIsValidSignature(
      initiatorEphemeralAddress,
      virtualAppSetStateCommitment,
      initiatorSignatureOnVirtualAppSetStateCommitment,
    );

    const responderSignatureOnTimeLockedPassThroughSetStateCommitment = yield [
      OP_SIGN,
      timeLockedPassThroughSetStateCommitment,
      timeLockedPassThroughAppInstance.appSeqNo,
    ];

    const responderSignatureOnVirtualAppSetStateCommitment = yield [
      OP_SIGN,
      virtualAppSetStateCommitment,
      virtualAppInstance.appSeqNo,
    ];
    timeLockedPassThroughSetStateCommitment.signatures = [
      initiatorSignatureOnTimeLockedPassThroughSetStateCommitment,
      responderSignatureOnTimeLockedPassThroughSetStateCommitment,
      intermediarySignatureOnTimeLockedPassThroughSetStateCommitment,
    ];

    yield [
      WRITE_COMMITMENT,
      SetState,
      timeLockedPassThroughSetStateCommitment,
      timeLockedPassThroughAppInstance.identityHash,
    ];

    virtualAppSetStateCommitment.signatures = [
      initiatorSignatureOnVirtualAppSetStateCommitment,
      responderSignatureOnVirtualAppSetStateCommitment,
    ];
    yield [
      WRITE_COMMITMENT,
      SetState,
      virtualAppSetStateCommitment,
      virtualAppInstance.identityHash,
    ];

    const m7 = {
      protocol,
      processID,
      toXpub: intermediaryXpub,
      seq: UNASSIGNED_SEQ_NO,
      customData: {
        signature: responderSignatureOnTimeLockedPassThroughSetStateCommitment,
        signature2: responderSignatureOnVirtualAppSetStateCommitment,
      },
    } as ProtocolMessage;

    yield [IO_SEND, m7];

    yield [
      PERSIST_STATE_CHANNEL,
      [
        stateChannelWithIntermediary,
        stateChannelWithRespondingAndIntermediary,
        stateChannelWithInitiating,
      ],
    ];
  */
  },
};

// todo(xuanji): make this more consistent with the function
// with the same name from install.ts. This involves refactoring
// the callers.
function computeInterpreterParameters(
  outcomeType: OutcomeType,
  initiatingAddress: string,
  respondingAddress: string,
  initiatingBalanceDecrement: BigNumber,
  respondingBalanceDecrement: BigNumber,
  tokenAddress: string,
) {
  const multiAssetMultiPartyCoinTransferInterpreterParams:
    | MultiAssetMultiPartyCoinTransferInterpreterParams
    | undefined = undefined;

  let twoPartyOutcomeInterpreterParams:
    | TwoPartyFixedOutcomeInterpreterParams
    | undefined = undefined;

  let singleAssetTwoPartyCoinTransferInterpreterParams:
    | SingleAssetTwoPartyCoinTransferInterpreterParams
    | undefined = undefined;

  // debug
  if (outcomeType === undefined) {
    throw Error("This really should have been caught earlier");
  }

  switch (outcomeType) {
    case OutcomeType.TWO_PARTY_FIXED_OUTCOME: {
      twoPartyOutcomeInterpreterParams = {
        tokenAddress,
        playerAddrs: [initiatingAddress, respondingAddress],
        amount: bigNumberify(initiatingBalanceDecrement).add(respondingBalanceDecrement),
      };
      break;
    }

    case OutcomeType.SINGLE_ASSET_TWO_PARTY_COIN_TRANSFER: {
      singleAssetTwoPartyCoinTransferInterpreterParams = {
        tokenAddress,
        limit: bigNumberify(initiatingBalanceDecrement).add(respondingBalanceDecrement),
      };
      break;
    }

    default: {
      throw Error(`Not supported, and weird outcome type: ${outcomeType}`);
    }
  }
  return {
    multiAssetMultiPartyCoinTransferInterpreterParams,
    twoPartyOutcomeInterpreterParams,
    singleAssetTwoPartyCoinTransferInterpreterParams,
  };
}

/**
 * Creates a shared AppInstance that represents the Virtual App being installed.
 *
 * NOTE: There is NO interpreter for this AppInstance since nothing interprets the outcome
 *       except for a TimeLockedPassThrough AppInstance that uses it inside of its own
 *       computeOutcome function.
 *
 * @param {StateChannel} stateChannelBetweenEndpoints - The StateChannel object between the endpoints
 * @param {InstallVirtualAppProtocolParams} params - Parameters of the new App to be installed
 *
 * @returns {AppInstance} an AppInstance with the correct metadata
 */
function constructVirtualAppInstance(params: InstallVirtualAppProtocolParams): AppInstance {
  const {
    initiatorXpub,
    responderXpub,
    defaultTimeout,
    appInterface,
    initialState,
    outcomeType,
    initiatorBalanceDecrement,
    responderBalanceDecrement,
    tokenAddress,
    appSeqNo,
  } = params;

  const initiatorAddress = xkeyKthAddress(initiatorXpub, appSeqNo);
  const responderAddress = xkeyKthAddress(responderXpub, appSeqNo);

  const {
    multiAssetMultiPartyCoinTransferInterpreterParams,
    twoPartyOutcomeInterpreterParams,
    singleAssetTwoPartyCoinTransferInterpreterParams,
  } = computeInterpreterParameters(
    outcomeType,
    initiatorAddress,
    responderAddress,
    initiatorBalanceDecrement,
    responderBalanceDecrement,
    tokenAddress,
  );

  return new AppInstance(
    /* participants */ sortAddresses([initiatorAddress, responderAddress]),
    defaultTimeout,
    appInterface,
    /* isVirtualApp */ true,
    /* appSeqNo */ appSeqNo,
    /* initialState */ initialState,
    /* versionNumber */ 0,
    /* latestTimeout */ defaultTimeout,
    outcomeType,
    twoPartyOutcomeInterpreterParams,
    multiAssetMultiPartyCoinTransferInterpreterParams,
    singleAssetTwoPartyCoinTransferInterpreterParams,
  );
}

/**
 * Creates a shared AppInstance that represents the AppInstance whose outcome
 * determines how any VirtualAppAgreements play out. It depends on a VirtualApp.
 *
 * NOTE: This AppInstance is currently HARD-CODED to only work with interpreters
 *       that can understand the TwoPartyFixedOutcome outcome type. Currently
 *       we use the TwoPartyFixedOutcomeFromVirtualAppInterpreter for all
 *       commitments between users and an intermediary to handle Virtual Apps.
 *
 * @param {StateChannel} threePartyStateChannel - The StateChannel object with all 3
 *        participants of this protocol as the owner-set.
 *
 * @param {InstallVirtualAppProtocolParams} params - Parameters of the new App to be installed
 *
 * @returns {AppInstance} an AppInstance with the correct metadata
 */
function constructTimeLockedPassThroughAppInstance(
  threePartyStateChannel: StateChannel,
  virtualAppInstanceIdentityHash: string,
  virtualAppDefaultOutcome: string,
  network: NetworkContext,
  params: InstallVirtualAppProtocolParams,
): AppInstance {
  const {
    intermediaryXpub,
    initiatorXpub,
    responderXpub,
    initiatorBalanceDecrement,
    responderBalanceDecrement,
    outcomeType,
    tokenAddress,
  } = params;

  const seqNo = threePartyStateChannel.numProposedApps;

  const intermediaryAddress = xkeyKthAddress(intermediaryXpub, seqNo);
  const initiatorAddress = xkeyKthAddress(initiatorXpub, seqNo);
  const responderAddress = xkeyKthAddress(responderXpub, seqNo);

  const HARD_CODED_CHALLENGE_TIMEOUT = 100;

  const {
    multiAssetMultiPartyCoinTransferInterpreterParams,
    twoPartyOutcomeInterpreterParams,
    singleAssetTwoPartyCoinTransferInterpreterParams,
  } = computeInterpreterParameters(
    outcomeType,
    initiatorAddress,
    responderAddress,
    initiatorBalanceDecrement,
    responderBalanceDecrement,
    tokenAddress,
  );

  return new AppInstance(
    /* participants */
    sortAddresses([initiatorAddress, responderAddress, intermediaryAddress]),
    /* defaultTimeout */ HARD_CODED_CHALLENGE_TIMEOUT,
    /* appInterface */ {
      stateEncoding: `tuple(address challengeRegistryAddress, bytes32 targetAppIdentityHash, uint256 switchesOutcomeAt, bytes defaultOutcome)`,
      actionEncoding: undefined,
      addr: network.TimeLockedPassThrough,
    },
    /* isVirtualApp */ true,
    /* appSeqNo */ seqNo,
    {
      challengeRegistryAddress: network.ChallengeRegistry,
      targetAppIdentityHash: virtualAppInstanceIdentityHash,
      // FIXME: This number _should_ be MaxUint256 so that we can have no timeouts for
      //        virtual apps at the moment, but it needs to be Zero for now otherwise
      //        calling computeOutcome won't work on it because it relies on another
      //        app's outcome which; in the challenge registry, is 0x.
      switchesOutcomeAt: MaxUint256,
      defaultOutcome: virtualAppDefaultOutcome,
    },
    /* versionNumber */ 0,
    /* latestTimeout */ HARD_CODED_CHALLENGE_TIMEOUT,
    /* outcomeType */ outcomeType,
    /* twoPartyOutcomeInterpreterParams */ twoPartyOutcomeInterpreterParams,
    /* multiAssetMultiPartyCoinTransferInterpreterParams */ multiAssetMultiPartyCoinTransferInterpreterParams,
    /* singleAssetTwoPartyCoinTransferInterpreterParams */ singleAssetTwoPartyCoinTransferInterpreterParams,
  );
}

/**
 * Gets a StateChannel between the two endpoint users. It may not already exist, in which
 * case it constructs a StateChannel object to be used.
 *
 * Note that this method has the "getOrCreate" prefix because if this is the _first_
 * time that a virtual app is instantiated between these counterparties that goes
 * through this intermediary then the `StateChannel` will not exist in the stateChannelsMap
 * of any of the participants so it needs to be created. If, however, this is not the first
 * time then there will be an object in the stateChannelsMap that can be fetched by using
 * the unique identifier for the wrapper StateChannel.
 *
 * @param {Map<string, StateChannel>} stateChannelsMap - map of StateChannels to query
 * @param {[string, string]} userXpubs - List of users
 * @param {NetworkContext} network - Metadata on the current blockchain
 *
 * @returns {StateChannel} - a stateChannelWithAllThreeParties
 */
async function getOrCreateStateChannelWithUsers(
  store: Store,
  userXpubs: string[],
  network: NetworkContext,
): Promise<StateChannel> {
  const multisigAddress = await store.getMultisigAddressWithCounterparty(
    userXpubs,
    network.ProxyFactory,
    network.MinimumViableMultisig,
    network.provider,
  );

  return (
    (await store.getStateChannelIfExists(multisigAddress)) ||
    StateChannel.createEmptyChannel(
      multisigAddress,
      {
        proxyFactory: network.ProxyFactory,
        multisigMastercopy: network.MinimumViableMultisig,
      },
      userXpubs,
    )
  );
}

/**
async function getUpdatedStateChannelAndVirtualAppObjectsForInitiating(
  params: InstallVirtualAppProtocolParams,
  store: Store,
  network: NetworkContext,
  provider: BaseProvider,
): Promise<[StateChannel, StateChannel, StateChannel, AppInstance, AppInstance]> {
  const {
    initiatorXpub,
    intermediaryXpub,
    responderXpub,
    tokenAddress,
    initiatorBalanceDecrement,
    responderBalanceDecrement,
  } = params as InstallVirtualAppProtocolParams;

  const stateChannelWithAllThreeParties = await getOrCreateStateChannelWithUsers(
    store,
    [initiatorXpub, responderXpub, intermediaryXpub],
    network,
  );

  const stateChannelWithResponding = await getOrCreateStateChannelWithUsers(
    store,
    [initiatorXpub, responderXpub],
    network,
  );

  const virtualAppInstance = constructVirtualAppInstance(params);

  const timeLockedPassThroughAppInstance = await constructTimeLockedPassThroughAppInstance(
    stateChannelWithAllThreeParties,
    virtualAppInstance.identityHash,
    await virtualAppInstance.computeOutcomeWithCurrentState(provider),
    network,
    params,
  );

  const multisigAddressWithIntermediary = await store.getMultisigAddressWithCounterparty(
    [initiatorXpub, intermediaryXpub],
    network.ProxyFactory,
    network.MinimumViableMultisig,
  );

  const stateChannelWithIntermediary = await store.getStateChannelIfExists(
    multisigAddressWithIntermediary,
  );

  if (!stateChannelWithIntermediary) {
    throw Error("Cannot run InstallVirtualAppProtocol without existing channel with intermediary");
  }

  // initiator should have sufficient funds to cover their deposits
  // in channel with intermediary
  assertSufficientFundsWithinFreeBalance(
    stateChannelWithIntermediary,
    initiatorXpub,
    tokenAddress,
    initiatorBalanceDecrement,
  );

  // initiator should have sufficient funds to cover their deposits
  // in channel with responding (if exists)
  // see note in fn, will not fail if no `FreeBalance` class
  assertSufficientFundsWithinFreeBalance(
    stateChannelWithResponding,
    initiatorXpub,
    tokenAddress,
    initiatorBalanceDecrement,
  );

  // intermediary should have sufficient funds in its channel with
  // initiator to cover the counterpartys deposit
  assertSufficientFundsWithinFreeBalance(
    stateChannelWithIntermediary,
    intermediaryXpub,
    tokenAddress,
    responderBalanceDecrement,
  );

  const intermediaryAddress = stateChannelWithIntermediary.getMultisigOwnerAddrOf(intermediaryXpub);

  const initiatorAddress = stateChannelWithIntermediary.getMultisigOwnerAddrOf(initiatorXpub);

  const newStateChannelWithIntermediary = stateChannelWithIntermediary.addSingleAssetTwoPartyIntermediaryAgreement(
    virtualAppInstance.identityHash,
    {
      tokenAddress,
      timeLockedPassThroughIdentityHash: timeLockedPassThroughAppInstance.identityHash,
      capitalProvided: bigNumberify(initiatorBalanceDecrement)
        .add(responderBalanceDecrement)
        .toHexString(),
      capitalProvider: intermediaryAddress,
      virtualAppUser: initiatorAddress,
    },
    {
      [initiatorAddress]: initiatorBalanceDecrement,
      [intermediaryAddress]: responderBalanceDecrement,
    },
    tokenAddress,
  );

  return [
    stateChannelWithAllThreeParties.addAppInstance(timeLockedPassThroughAppInstance),
    stateChannelWithResponding.addAppInstance(virtualAppInstance),
    newStateChannelWithIntermediary,
    virtualAppInstance,
    timeLockedPassThroughAppInstance,
  ];
}

async function getUpdatedStateChannelAndVirtualAppObjectsForIntermediary(
  params: InstallVirtualAppProtocolParams,
  store: Store,
  virtualAppInstanceIdentityHash: string,
  virtualAppInstanceDefaultOutcome: string,
  network: NetworkContext,
): Promise<[StateChannel, StateChannel, StateChannel, AppInstance]> {
  const {
    initiatorBalanceDecrement,
    responderBalanceDecrement,
    initiatorXpub,
    intermediaryXpub,
    responderXpub,
    tokenAddress,
  } = params as InstallVirtualAppProtocolParams;

  const stateChannelWithAllThreeParties = await getOrCreateStateChannelWithUsers(
    store,
    [initiatorXpub, responderXpub, intermediaryXpub],
    network,
  );

  const timeLockedPassThroughAppInstance = await constructTimeLockedPassThroughAppInstance(
    stateChannelWithAllThreeParties,
    virtualAppInstanceIdentityHash,
    virtualAppInstanceDefaultOutcome,
    network,
    params,
  );

  const multisigAddressWithIntermediary = await store.getMultisigAddressWithCounterparty(
    [initiatorXpub, intermediaryXpub],
    network.ProxyFactory,
    network.MinimumViableMultisig,
  );

  const channelWithInitiating = await store.getStateChannelIfExists(
    multisigAddressWithIntermediary,
  );

  if (!channelWithInitiating) {
    throw Error("Cannot mediate InstallVirtualAppProtocol without mediation channel to initiator");
  }

  const multisigAddressWithResponding = await store.getMultisigAddressWithCounterparty(
    [responderXpub, intermediaryXpub],
    network.ProxyFactory,
    network.MinimumViableMultisig,
  );

  const channelWithResponding = await store.getStateChannelIfExists(multisigAddressWithResponding);

  if (!channelWithResponding) {
    throw Error("Cannot mediate InstallVirtualAppProtocol without mediation channel to responder");
  }

  // intermediary should be able to cover virtual app
  // counterparty's deposits from its free balance
  assertSufficientFundsWithinFreeBalance(
    channelWithInitiating,
    intermediaryXpub,
    tokenAddress,
    responderBalanceDecrement,
  );

  assertSufficientFundsWithinFreeBalance(
    channelWithResponding,
    intermediaryXpub,
    tokenAddress,
    initiatorBalanceDecrement,
  );

  // TODO: should the intermediary have sufficient funds
  // in the three way channel?

  const initiatorAddress = xkeyKthAddress(initiatorXpub, 0);
  const intermediaryAddress = xkeyKthAddress(intermediaryXpub, 0);
  const responderAddress = xkeyKthAddress(responderXpub, 0);

  return [
    stateChannelWithAllThreeParties.addAppInstance(timeLockedPassThroughAppInstance),

    channelWithInitiating.addSingleAssetTwoPartyIntermediaryAgreement(
      virtualAppInstanceIdentityHash,
      {
        tokenAddress,
        timeLockedPassThroughIdentityHash: timeLockedPassThroughAppInstance.identityHash,
        capitalProvided: bigNumberify(initiatorBalanceDecrement)
          .add(responderBalanceDecrement)
          .toHexString(),
        capitalProvider: intermediaryAddress,
        virtualAppUser: initiatorAddress,
      },
      {
        [initiatorAddress]: initiatorBalanceDecrement,
        [intermediaryAddress]: responderBalanceDecrement,
      },
      tokenAddress,
    ),

    channelWithResponding.addSingleAssetTwoPartyIntermediaryAgreement(
      virtualAppInstanceIdentityHash,
      {
        tokenAddress,
        timeLockedPassThroughIdentityHash: timeLockedPassThroughAppInstance.identityHash,
        capitalProvided: bigNumberify(initiatorBalanceDecrement)
          .add(responderBalanceDecrement)
          .toHexString(),
        capitalProvider: intermediaryAddress,
        virtualAppUser: responderAddress,
      },
      {
        [intermediaryAddress]: initiatorBalanceDecrement,
        [responderAddress]: responderBalanceDecrement,
      },
      tokenAddress,
    ),

    timeLockedPassThroughAppInstance,
  ];
}

async function getUpdatedStateChannelAndVirtualAppObjectsForResponding(
  params: InstallVirtualAppProtocolParams,
  store: Store,
  network: NetworkContext,
  provider: BaseProvider,
): Promise<[StateChannel, StateChannel, StateChannel, AppInstance, AppInstance]> {
  const {
    initiatorBalanceDecrement,
    responderBalanceDecrement,
    initiatorXpub,
    intermediaryXpub,
    responderXpub,
    tokenAddress,
  } = params as InstallVirtualAppProtocolParams;

  const stateChannelWithAllThreeParties = await getOrCreateStateChannelWithUsers(
    store,
    [initiatorXpub, responderXpub, intermediaryXpub],
    network,
  );

  const stateChannelWithInitiating = await getOrCreateStateChannelWithUsers(
    store,
    [initiatorXpub, responderXpub],
    network,
  );

  const virtualAppInstance = constructVirtualAppInstance(params);

  const timeLockedPassThroughAppInstance = constructTimeLockedPassThroughAppInstance(
    stateChannelWithAllThreeParties,
    virtualAppInstance.identityHash,
    await virtualAppInstance.computeOutcomeWithCurrentState(provider),
    network,
    params,
  );

  const multisigAddressWithIntermediary = await store.getMultisigAddressWithCounterparty(
    [responderXpub, intermediaryXpub],
    network.ProxyFactory,
    network.MinimumViableMultisig,
  );
  const stateChannelWithIntermediary = await store.getStateChannelIfExists(
    multisigAddressWithIntermediary,
  );

  if (!stateChannelWithIntermediary) {
    throw Error("Cannot run InstallVirtualAppProtocol without existing channel with intermediary");
  }

  // responder should have sufficient funds to cover their deposits
  // in channel with intermediary
  assertSufficientFundsWithinFreeBalance(
    stateChannelWithIntermediary,
    responderXpub,
    tokenAddress,
    responderBalanceDecrement,
  );

  // intermediary should have sufficient funds in its channel with
  // responder to cover the counterpartys deposit
  assertSufficientFundsWithinFreeBalance(
    stateChannelWithIntermediary,
    intermediaryXpub,
    tokenAddress,
    initiatorBalanceDecrement,
  );

  // initiator should have sufficient funds to cover their deposits
  // in channel with responding (if exists)
  // see note in fn, will not fail if no `FreeBalance` class
  assertSufficientFundsWithinFreeBalance(
    stateChannelWithInitiating,
    responderXpub,
    tokenAddress,
    responderBalanceDecrement,
  );

  const intermediaryAddress = xkeyKthAddress(intermediaryXpub, 0);
  const responderAddress = xkeyKthAddress(responderXpub, 0);

  return [
    stateChannelWithAllThreeParties.addAppInstance(timeLockedPassThroughAppInstance),

    stateChannelWithInitiating.addAppInstance(virtualAppInstance),

    stateChannelWithIntermediary.addSingleAssetTwoPartyIntermediaryAgreement(
      virtualAppInstance.identityHash,
      {
        tokenAddress,
        timeLockedPassThroughIdentityHash: timeLockedPassThroughAppInstance.identityHash,
        capitalProvided: bigNumberify(initiatorBalanceDecrement)
          .add(responderBalanceDecrement)
          .toHexString(),
        capitalProvider: intermediaryAddress,
        virtualAppUser: responderAddress,
      },
      {
        [intermediaryAddress]: initiatorBalanceDecrement,
        [responderAddress]: responderBalanceDecrement,
      },
      tokenAddress,
    ),

    virtualAppInstance,

    timeLockedPassThroughAppInstance,
  ];
}
*/
