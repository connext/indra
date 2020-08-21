import { EntityRepository, Repository } from "typeorm";
import { AppAction } from "@connext/types";

import { Transfer } from "./transfer.entity";

@EntityRepository(Transfer)
export class TransferRepository extends Repository<Transfer<any>> {
  async removeTransferSecret(receiverAppIdentityHash: string, action?: AppAction) {
    throw new Error(`how to implement`);
  }

  async addTransferSecret(receiverAppIdentityHash: string, action?: AppAction) {
    throw new Error(`how to implement`);
  }

}
