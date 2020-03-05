import { EntityRepository, Repository } from "typeorm";

import { FastSignedTransfer } from "./fastSignedTransfer.entity";

@EntityRepository(FastSignedTransfer)
export class FastSignedTransferRepository extends Repository<FastSignedTransfer> {}
