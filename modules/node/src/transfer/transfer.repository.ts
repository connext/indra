import { EntityRepository, Repository } from "typeorm";

import { LinkedTransfer, PeerToPeerTransfer } from "./transfer.entity";

@EntityRepository(PeerToPeerTransfer)
export class PeerToPeerTransferRepository extends Repository<PeerToPeerTransfer> {}

@EntityRepository(LinkedTransfer)
export class LinkedTransferRepository extends Repository<LinkedTransfer> {}
