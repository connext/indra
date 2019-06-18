import { EntityRepository, Repository } from "typeorm";

import { User } from "./user.entity";

@EntityRepository(User)
export class UserRepository extends Repository<User> {
  async findByXpub(xpub: string): Promise<User | undefined> {
    return await this.createQueryBuilder("user")
      .leftJoinAndSelect("user.channels", "channel")
      .where("user.xpub = :xpub", { xpub })
      .getOne();
  }
}
