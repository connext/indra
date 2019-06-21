import { EntityRepository, Repository } from "typeorm";

import { User } from "./user.entity";

@EntityRepository(User)
export class UserRepository extends Repository<User> {
  async findByPublicIdentifier(pubId: string): Promise<User | undefined> {
    return await this.findOne({ where: { publicIdentifier: pubId } });
  }
}
