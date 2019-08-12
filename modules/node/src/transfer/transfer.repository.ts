import { EntityRepository, Repository } from "typeorm";

import { Transfer } from "./transfer.entity";

@EntityRepository(Transfer)
export class TransferRepository extends Repository<Transfer> {}
