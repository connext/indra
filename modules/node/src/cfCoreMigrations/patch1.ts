import { Node } from "@counterfactual/types";
import { bigNumberify, BigNumberish } from "ethers/utils";

const DB_NAMESPACE_CHANNEL = "channel";
const DB_NAMESPACE_WITHDRAWALS = "multisigAddressToWithdrawalCommitment";
const DB_NAMESPACE_ALL_COMMITMENTS = "allCommitments";

const bigNumberIshToString = (x: BigNumberish): string => bigNumberify(x).toHexString();

export const migrateToPatch1 = async (
  storeService: Node.IStoreService,
  storeKeyPrefix: string,
): Promise<void> => {
  const stateChannelsMap: {
    [multisigAddress: string]: any;
  } = await (storeService as any).getV0(`${storeKeyPrefix}/${DB_NAMESPACE_CHANNEL}`);

  const existingMap = await storeService.get(storeKeyPrefix);

  for (const multisigAddress in stateChannelsMap) {
    if (!stateChannelsMap[multisigAddress].multisigAddress) {
      console.warn(
        `Found a malformed entry in the state channels map ${JSON.stringify(
          stateChannelsMap,
          null,
          2,
        )}`,
      );
      continue;
    }
    /**
     * Update proposal:
     * https://github.com/counterfactual/monorepo/pull/2542/files
     */

    const proposals = stateChannelsMap[multisigAddress].proposedAppInstances;

    for (let i = 0; i < proposals.length; i += 1) {
      const proposal = proposals[i][1];
      stateChannelsMap[multisigAddress].proposedAppInstances[i][1] = {
        ...proposal,
        initiatorDeposit: bigNumberIshToString(proposal.initiatorDeposit),
        responderDeposit: bigNumberIshToString(proposal.responderDeposit),
        timeout: bigNumberIshToString(proposal.timeout),
      };
    }

    /**
     * Update interpreter params
     * https://github.com/counterfactual/monorepo/pull/2544/files#diff-95c2150ee50c44be12700a72fd6fbf73R32
     */

    const apps = stateChannelsMap[multisigAddress].appInstances;

    for (let i = 0; i < apps.length; i += 1) {
      const app = apps[i][1];

      if (app.twoPartyOutcomeInterpreterParams) {
        stateChannelsMap[multisigAddress].appInstances[i][1].twoPartyOutcomeInterpreterParams = {
          ...app.twoPartyOutcomeInterpreterParams!,
          amount: bigNumberIshToString(app.twoPartyOutcomeInterpreterParams!.amount),
        };
      }

      if (app.singleAssetTwoPartyCoinTransferInterpreterParams) {
        stateChannelsMap[multisigAddress].appInstances[
          i
        ][1].singleAssetTwoPartyCoinTransferInterpreterParams = {
          ...app.singleAssetTwoPartyCoinTransferInterpreterParams!,
          limit: bigNumberIshToString(app.singleAssetTwoPartyCoinTransferInterpreterParams!.limit),
        };
      }

      if (app.multiAssetMultiPartyCoinTransferInterpreterParams) {
        stateChannelsMap[multisigAddress].appInstances[
          i
        ][1].multiAssetMultiPartyCoinTransferInterpreterParams = {
          ...app.multiAssetMultiPartyCoinTransferInterpreterParams!,
          limit: app.multiAssetMultiPartyCoinTransferInterpreterParams.limit.map(
            bigNumberIshToString!,
          ),
        };
      }
    }

    /**
     * Delete createdAt
     * https://github.com/counterfactual/monorepo/pull/2541/files
     */
    delete stateChannelsMap[multisigAddress]["createdAt"];

    /**
     * https://github.com/counterfactual/monorepo/pull/2538/files
     */

    const agreements = stateChannelsMap[multisigAddress].singleAssetTwoPartyIntermediaryAgreements;

    for (let i = 0; i < agreements.length; i += 1) {
      const agreement = agreements[i][1];
      stateChannelsMap[multisigAddress].singleAssetTwoPartyIntermediaryAgreements[i][1] = {
        ...agreements[i][1],
        capitalProvided: bigNumberIshToString(agreement.capitalProvided),
      };
    }
  }

  const withdrawals =
    (await (storeService as any).getV0(`${storeKeyPrefix}/${DB_NAMESPACE_WITHDRAWALS}`)) || {};

  const commitments =
    (await (storeService as any).getV0(`${storeKeyPrefix}/${DB_NAMESPACE_ALL_COMMITMENTS}`)) || {};

  // merge records with existingMap
  for (const multisigAddress in stateChannelsMap) {
    if (existingMap.stateChannelsMap[multisigAddress]) {
      console.warn(
        `Uh oh, record exists for ${multisigAddress}, refusing to overwrite: ${JSON.stringify(
          existingMap.stateChannelsMap[multisigAddress],
        )}`,
      );
      continue;
    }
    existingMap.stateChannelsMap[multisigAddress] = stateChannelsMap[multisigAddress];
  }

  for (const hash in commitments) {
    if (existingMap.commitments[hash]) {
      console.warn(
        `Uh oh, record exists for ${hash}, refusing to overwrite: ${JSON.stringify(
          existingMap.commitments[hash],
        )}`,
      );
      continue;
    }
    existingMap.commitments[hash] = stateChannelsMap[hash];
  }

  for (const address in withdrawals) {
    if (existingMap.withdrawals[address]) {
      console.warn(
        `Uh oh, record exists for ${address}, refusing to overwrite: ${JSON.stringify(
          existingMap.withdrawals[address],
        )}`,
      );
      continue;
    }
    existingMap.withdrawals[address] = stateChannelsMap[address];
  }

  await storeService.set([{ path: storeKeyPrefix, value: existingMap }]);
};
