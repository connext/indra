import { EntityRepository, Repository } from "typeorm";

import { PaymentProfile } from "./paymentProfile.entity";

@EntityRepository(PaymentProfile)
export class PaymentProfileRepository extends Repository<PaymentProfile> {}
