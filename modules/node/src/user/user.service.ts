import { Injectable } from "@nestjs/common";

import { CLogger } from "../util";

import { UserRepository } from "./user.repository";

const logger = new CLogger("UserService");

@Injectable()
export class UserService {
  constructor(private readonly userRepository: UserRepository) {}
}
