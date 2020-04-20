import { MessagingAuthService } from "@connext/messaging";
import { PublicIdentifier } from "@connext/types";
import {
  createRandom32ByteHexString,
  getAddressError,
  getSignerAddressFromPublicIdentifier,
  isValidPublicIdentifier,
  verifyChannelMessage,
} from "@connext/utils";
import { Injectable, Inject } from "@nestjs/common";

import { ChannelRepository } from "../channel/channel.repository";
import { LoggerService } from "../logger/logger.service";
import { ConfigService } from "../config/config.service";

import { MessagingAuthProviderId } from "../constants";

const nonceTTL = 24 * 60 * 60 * 1000; // 1 day

export function getAuthAddressFromIdentifier(id: PublicIdentifier): string {
  return getSignerAddressFromPublicIdentifier(id);
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

  async getNonce(userIdentifier: string): Promise<string> {
    const nonce = createRandom32ByteHexString();
    const expiry = Date.now() + nonceTTL;
    // FIXME-- store nonce in redis instead of here...
    this.nonces[userIdentifier] = { expiry, nonce };
    this.log.debug(
      `getNonce: Gave address ${userIdentifier} a nonce that expires at ${expiry}: ${nonce}`,
    );
    return nonce;
  }

  async verifyAndVend(
    signedNonce: string,
    userIdentifier: string,
    adminToken?: string,
  ): Promise<string> {
    const indraAdminToken = this.configService.get("INDRA_ADMIN_TOKEN");
    if (indraAdminToken && adminToken === indraAdminToken) {
      this.log.warn(`Vending admin token to ${userIdentifier}`);
      return this.vendAdminToken(userIdentifier);
    }

    const address = getSignerAddressFromPublicIdentifier(userIdentifier);
    this.log.debug(`Got address ${address} from userIdentifier ${userIdentifier}`);

    if (!this.nonces[userIdentifier]) {
      throw new Error(`User hasn't requested a nonce yet`);
    }

    const { nonce, expiry } = this.nonces[userIdentifier];
    const recovered = await verifyChannelMessage(nonce, signedNonce);
    if (recovered !== address) {
      throw new Error(`Verification failed, expected ${address}, got ${recovered}`);
    }
    if (Date.now() > expiry) {
      throw new Error(`Verification failed... nonce expired for address: ${userIdentifier}`);
    }

    // Try to get latest published OR move everything under address route.
    let permissions = {
      publish: {
        allow: [`${userIdentifier}.>`, `${this.configService.getMessagingKey()}.>`],
      },
      subscribe: {
        allow: [`>`],
      },
      // response: {
      // TODO: consider some sane ttl to safeguard DDOS
      // },
    };

    const jwt = this.messagingAuthService.vend(userIdentifier, nonceTTL, permissions);
    return jwt;
  }

  async vendAdminToken(userIdentifier: string): Promise<string> {
    const permissions = {
      publish: {
        allow: [`>`],
      },
      subscribe: {
        allow: [`>`],
      },
    };

    const jwt = this.messagingAuthService.vend(userIdentifier, nonceTTL, permissions);
    return jwt;
  }

  parseAddress(callback: any): any {
    return async (subject: string, data: any): Promise<string> => {
      // Get & validate address from subject
      const address = subject.split(".")[0]; // first item of subscription is address
      const addressError = getAddressError(address);
      if (addressError) {
        throw new Error(`Subject's first item isn't a valid address: ${addressError}`);
      }
      return callback(address, data);
    };
  }

  parseIdentifier(callback: any): any {
    return async (subject: string, data: any): Promise<string> => {
      // Get & validate address from subject
      const identifier = subject.split(".")[0]; // first item of subscription is id
      if (!identifier || !isValidPublicIdentifier(identifier)) {
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
