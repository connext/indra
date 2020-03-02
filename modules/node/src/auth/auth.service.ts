import { Injectable } from "@nestjs/common";
import { arrayify, hexlify, randomBytes, verifyMessage } from "ethers/utils";
import { fromExtendedKey } from "ethers/utils/hdnode";

import { ChannelRepository } from "../channel/channel.repository";
import { LoggerService } from "../logger/logger.service";
import { ConfigService } from "../config/config.service";

import { isXpub } from "../util";
import { MessagingAuthService } from "@connext/messaging";

const logger = new LoggerService("AuthService");
const nonceLen = 16;
const nonceTTL = 24 * 60 * 60 * 1000; // 1 day

export function getAuthAddressFromXpub(xpub: string): string {
  return fromExtendedKey(xpub).derivePath("0").address;
}

@Injectable()
export class AuthService {
  private nonces: { [key: string]: { nonce: string; expiry: number } } = {};
  constructor(
    private readonly channelRepo: ChannelRepository,
    private readonly messagingAuthSerivice: MessagingAuthService,
    private readonly configService: ConfigService,
  ) {}

  // FIXME-- fix this client api contract error...
  // TODO-- get ops/start_prod.sh placeholders filled out
  async getNonce(userPublicIdentifier: string): Promise<string> {
    const nonce = hexlify(randomBytes(nonceLen));
    const expiry = Date.now() + nonceTTL;
    // FIXME-- store nonce in redis instead of here...
    this.nonces[userPublicIdentifier] = { expiry, nonce };
    logger.debug(
      `getNonce: Gave xpub ${userPublicIdentifier} a nonce that expires at ${expiry}: ${nonce}`,
    );
    return nonce;
  }

  async verifyAndVend(signedNonce: string, userPublicIdentifier: string): Promise<string> {
    const xpubAddress = getAuthAddressFromXpub(userPublicIdentifier);
    logger.debug(`Got address ${xpubAddress} from xpub ${userPublicIdentifier}`);

    const { nonce, expiry } = this.nonces[userPublicIdentifier];
    const addr = verifyMessage(arrayify(nonce), signedNonce);
    if (addr !== xpubAddress) {
      throw new Error(`verification failed`);
    }
    if (Date.now() > expiry) {
      throw new Error(`verification failed... nonce expired for xpub: ${userPublicIdentifier}`);
    }

    // TODO -- ARJUN: Change client to subscribe to app-registry/config. Try to get latest published OR move everything under xpub route.
    const permissions = {
      publish: {
        allow: [`${userPublicIdentifier}.>`],
        // deny: [],
      },
      subscribe: {
        allow: [`${userPublicIdentifier}.>`, `app-registry.>`, `swap-rate.>`, `config.>`],
        // deny: [],
      },
      // response: {
      // TODO: consider some sane ttl to safeguard DDOS
      // },
    };

    // if(userPublicIdentifier = config.)

    const jwt = this.messagingAuthSerivice.vend(userPublicIdentifier, nonceTTL, permissions);
    logger.debug(``);
    return jwt;
  }

  parseXpub(callback: any): any {
    return async (subject: string, data: any): Promise<string> => {
      // Get & validate xpub from subject
      const xpub = subject.split(".")[0]; // first item of subscription is xpub
      if (!xpub || !isXpub(xpub)) {
        throw new Error(`Subject's first item isn't a valid xpub: ${subject}`)
      }
      return callback(xpub, data);
    };
  }

  parseLock(callback: any): any {
    return async (subject: string, data: any): Promise<string> => {
      const xpub = subject.split(".")[0]; // first item of subscription is xpub
      const lockName = subject.split(".").pop(); // last item of subject is lockName
      const channel = await this.channelRepo.findByUserPublicIdentifier(xpub);

      // TODO need to validate that lockName is EITHER multisig OR [multisig, appInstanceId]
      //      holding off on this right now because it will be *much* easier to iterate through
      //      all appInstanceIds after our store refactor.

      // if (lockName !== channel.multisigAddress || lockName !== ) {
      //   return this.badSubject(`Subject's last item isn't a valid lockName: ${subject}`);
      // }

      return callback(lockName, data);
    };
  }
}
