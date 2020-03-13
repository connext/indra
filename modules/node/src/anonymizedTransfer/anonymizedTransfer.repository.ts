import { EntityRepository, Repository, Between } from "typeorm";

import { AnonymizedTransfer } from "./anonymizedTransfer.entity";

@EntityRepository(AnonymizedTransfer)
export class AnonymizedTransferRepository extends Repository<AnonymizedTransfer> {
  async findInTimeRange(start: number, end: number): Promise<AnonymizedTransfer[]> {
    return await this.find({
      order: { createdAt: "DESC" },
      where: {
        createdAt: Between(new Date(start), new Date(end)),
      },
    });
  }
}
