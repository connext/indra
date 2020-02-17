import { EntityRepository, Repository } from "typeorm";

import { RebalanceProfile } from "./rebalanceProfile.entity";

@EntityRepository(RebalanceProfile)
export class RebalanceProfileRepository extends Repository<RebalanceProfile> {}
