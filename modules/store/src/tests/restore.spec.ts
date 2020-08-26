import { IStoreService, SetStateCommitmentJSON } from "@connext/types";

import { StoreTypes } from "../types";

import { createStore, expect } from "./utils";
import { toBN, stringify } from "@connext/utils";
import { RESTORE_RES, EXPECTED_CHANNEL } from "./fixtures/restore";

const storeTypes = Object.keys(StoreTypes);

const clearAndClose = async (store: IStoreService) => {
  await store.clear();
  await store.close();
};

describe("Restore", () => {
  storeTypes.forEach((type) => {
    it(`${type} - should restore a state properly`, async () => {
      /////////////////////////
      // copies implementation from setStateChannel in modules/client/src/channelProvider.ts
      // this is hacky
      const store = await createStore(type as StoreTypes);
      await store.updateSchemaVersion();
      const {
        channel,
        setStateCommitments,
        setupCommitment,
        conditionalCommitments,
      } = RESTORE_RES as any;
      // save the channel + setup commitment + latest free balance set state
      const freeBalanceSetStates = setStateCommitments
        .filter(([id, json]) => id === channel.freeBalanceAppInstance.identityHash)
        .sort((a, b) => toBN(b[1].versionNumber).sub(toBN(a[1].versionNumber)).toNumber());

      if (!freeBalanceSetStates[0]) {
        throw new Error(
          `Could not find latest free balance set state commitment: ${stringify(
            freeBalanceSetStates,
          )}`,
        );
      }
      await store.createStateChannel(channel, setupCommitment, freeBalanceSetStates[0][1]);
      // save all the app proposals + set states
      const proposals = [...channel.proposedAppInstances]
        .map(([id, json]) => json)
        .sort((a, b) => a.appSeqNo - b.appSeqNo);
      for (const proposal of proposals) {
        const setState = setStateCommitments.find(
          ([id, json]) => id === proposal.identityHash && toBN(json.versionNumber).eq(1),
        );
        if (!setState) {
          throw new Error(
            `Could not find set state commitment for proposal ${proposal.identityHash}`,
          );
        }
        const conditional = conditionalCommitments.find(
          ([id, json]) => id === proposal.identityHash,
        );
        if (!conditional) {
          throw new Error(
            `Could not find conditional commitment for proposal ${proposal.identityHash}`,
          );
        }
        await store.createAppProposal(
          channel.multisigAddress,
          proposal,
          proposal.appSeqNo,
          setState[1],
          conditional[1],
          channel,
        );
      }
      // save all the app instances + conditionals
      const appInstances = [...channel.appInstances]
        .map(([id, json]) => json)
        .sort((a, b) => a.appSeqNo - b.appSeqNo);
      for (const app of appInstances) {
        if (app.identityHash === channel.freeBalanceAppInstance.identityHash) {
          continue;
        }
        const conditional = conditionalCommitments.find(([id, _]) => id === app.identityHash);
        if (!conditional) {
          throw new Error(`Could not find set state commitment for proposal ${app.identityHash}`);
        }
        await store.createAppInstance(
          channel.multisigAddress,
          app,
          channel.freeBalanceAppInstance, // fb state saved on create
          ({
            appIdentityHash: channel.freeBalanceAppInstance.identityHash,
            versionNumber: app.appSeqNo,
          } as unknown) as SetStateCommitmentJSON,
          channel,
        );
      }

      // recreate state channel now to update the fields purely based on the restored state
      // TODO: should probably have a method in the store specifically to do this
      await store.createStateChannel(channel, setupCommitment, freeBalanceSetStates[0][1]);
      // end copied implementation
      /////////////////////////

      const restoredChannel = await store.getStateChannel(channel.multisigAddress);
      expect(restoredChannel).to.deep.eq(EXPECTED_CHANNEL);

      await clearAndClose(store);
    });
  });
});
