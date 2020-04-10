import { MessagingAuthService } from "@connext/messaging";
import { Injectable, Inject } from "@nestjs/common";
import { createRandomBytesHexString, getAddressFromIdentifier, PublicIdentifier } from "@connext/types";
import { verifyChannelMessage } from "@connext/crypto";

import { ChannelRepository } from "../channel/channel.repository";
import { LoggerService } from "../logger/logger.service";
import { ConfigService } from "../config/config.service";

import { isValidIdentifier, isAddress } from "../util";
import { MessagingAuthProviderId } from "../constants";

const nonceLen = 32;
const nonceTTL = 24 * 60 * 60 * 1000; // 1 day

export function getAuthAddressFromIdentifier(id: PublicIdentifier): string {
  return getAddressFromIdentifier(id);
}

@Injectable()
export class AuthService {
  private nonces: { [key: string]: { nonce: string; expiry: number } } = {};
  constructor(
    @Inject(MessagingAuthProviderId) private readonly messagingAuthService: MessagingAuthService,
    private readonly configService: ConfigService,
    private readonly log: LoggerService,
    private readonly channelRepo: ChannelRepository,
  ) {
    this.log.setContext("AuthService");
  }

  async getNonce(userPublicIdentifier: string): Promise<string> {
    const nonce = createRandomBytesHexString(nonceLen);
    const expiry = Date.now() + nonceTTL;
    // FIXME-- store nonce in redis instead of here...
    this.nonces[userPublicIdentifier] = { expiry, nonce };
    this.log.debug(
      `getNonce: Gave address ${userPublicIdentifier} a nonce that expires at ${expiry}: ${nonce}`,
    );
    return nonce;
  }

  async verifyAndVend(
    signedNonce: string,
    userPublicIdentifier: string,
    adminToken?: string,
  ): Promise<string> {
    const indraAdminToken = this.configService.get("INDRA_ADMIN_TOKEN");
    if (indraAdminToken && adminToken === indraAdminToken) {
      this.log.warn(`Vending admin token to ${userPublicIdentifier}`);
      return this.vendAdminToken(userPublicIdentifier);
    }

    const address = getAddressFromIdentifier(userPublicIdentifier);
    this.log.debug(`Got address ${address} from userPublicIdentifier ${userPublicIdentifier}`);

    if (!this.nonces[userPublicIdentifier]) {
      throw new Error(`User hasn't requested a nonce yet`);
    }

    const { nonce, expiry } = this.nonces[userPublicIdentifier];
    const recovered = await verifyChannelMessage(nonce, signedNonce);
    if (recovered !== address) {
      throw new Error(`Verification failed, expected ${address}, got ${recovered}`);
    }
    if (Date.now() > expiry) {
      throw new Error(`Verification failed... nonce expired for address: ${userPublicIdentifier}`);
    }

    const network = await this.configService.getEthNetwork();

    // Try to get latest published OR move everything under address route.
    let permissions = {
      publish: {
        allow: [`${userPublicIdentifier}.>`, `INDRA.${network.chainId}.>`],
      },
      subscribe: {
        allow: [`>`],
      },
      // response: {
      // TODO: consider some sane ttl to safeguard DDOS
      // },
    };

    const jwt = this.messagingAuthService.vend(userPublicIdentifier, nonceTTL, permissions);
    return jwt;
  }

  async vendAdminToken(userPublicIdentifier: string): Promise<string> {
    const permissions = {
      publish: {
        allow: [`>`],
      },
      subscribe: {
        allow: [`>`],
      },
    };

    const jwt = this.messagingAuthService.vend(userPublicIdentifier, nonceTTL, permissions);
    return jwt;
  }

  parseAddress(callback: any): any {
    return async (subject: string, data: any): Promise<string> => {
      // Get & validate address from subject
      const address = subject.split(".")[0]; // first item of subscription is address
      if (!address || !isAddress(address)) {
        throw new Error(`Subject's first item isn't a valid address: ${subject}`);
      }
      return callback(address, data);
    };
  }

  parseIdentifier(callback: any): any {
    return async (subject: string, data: any): Promise<string> => {
      // Get & validate address from subject
      const identifier = subject.split(".")[0]; // first item of subscription is id
      if (!identifier || !isValidIdentifier(identifier)) {
        throw new Error(`Subject's first item isn't a valid identifier: ${identifier}`);
      }
      return callback(identifier, data);
    };
  }

  parseLock(callback: any): any {
    return async (subject: string, data: any): Promise<string> => {
      const lockName = subject.split(".").pop(); // last item of subject is lockName

      // TODO need to validate that lockName is EITHER multisig OR [multisig, appIdentityHash]
      //      holding off on this right now because it will be *much* easier to iterate through
      //      all appIdentityHashs after our store refactor.

      // const address = subject.split(".")[0]; // first item of subscription is address
      // const channel = await this.channelRepo.findByUserPublicIdentifier(address);
      // if (lockName !== channel.multisigAddress || lockName !== ) {
      //   return this.badSubject(`Subject's last item isn't a valid lockName: ${subject}`);
      // }

      return callback(lockName, data);
    };
  }
}
