import { EntityRepository, Repository } from "typeorm";

import { PeerToPeerTransfer } from "./peerToPeerTransfer.entity";

@EntityRepository(PeerToPeerTransfer)
export class PeerToPeerTransferRepository extends Repository<PeerToPeerTransfer> {}
