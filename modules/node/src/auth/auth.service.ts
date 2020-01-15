import { Injectable } from "@nestjs/common";
import { arrayify, hexlify, randomBytes, verifyMessage, isHexString } from "ethers/utils";
import { fromExtendedKey } from "ethers/utils/hdnode";

import { ChannelRepository } from "../channel/channel.repository";
import { LoggerService } from "../logger/logger.service";
import { isValidHex, isXpub, isEthAddress } from "../util";
import { MessagingAuthService } from "@connext/messaging";
import { CLogger, isValidHex, isXpub, isEthAddress } from "../util";

// TODO: integrate JWT token

const logger = new CLogger("AuthService");
const nonceLen = 16;
const nonceTTL = 2 * 60 * 60 * 1000;

export function getAuthAddressFromXpub(xpub: string): string {
  return fromExtendedKey(xpub).derivePath("0").address;
}

@Injectable()
export class AuthService {
  private nonces: { [key: string]: { nonce: string; expiry: number } } = {};
  private signerCache: { [key: string]: string } = {};
  constructor(
    private readonly channelRepo: ChannelRepository,
    private readonly messagingAuthSerivice: MessagingAuthService,
  ) {}

  // FIXME-- fix this client api contract error...
  // TODO-- rearch subjects for <xpub>.fully.qualified.subject.with.id
  // TODO-- get ops/start_prod.sh placeholders filled out
  async getNonce(userPublicIdentifier: string): Promise<string> {
    const nonce = hexlify(randomBytes(nonceLen));
    const expiry = Date.now() + nonceTTL;
    // FIXME-- store nonce in redis instead of here...
    this.nonces[userPublicIdentifier] = { expiry, nonce };
    logger.debug(`getNonce: Gave xpub ${userPublicIdentifier} a nonce that expires at ${expiry}: ${nonce}`);
    return nonce;
  }

  async verifyAndVend(signedNonce: string, userPublicIdentifier: string): string {
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

    const permissions = {
      publish: {
        allow: [`${userPublicIdentifier}.>`],
        // deny: [],
      },
      subscribe: {
        allow: [`${userPublicIdentifier}.>`],
        // deny: [],
      },
      // response: {
      // TODO: consider some sane ttl to safeguard DDOS
      // },
    };

    // TODO... fixup this admin stuff
    // if (isAdmin) {
    //   do permissions stuff...
    // }

    const jwt = this.messagingAuthSerivice.vend(userPublicIdentifier, nonceTTL, permissions);
    logger.debug(``);
    return jwt;
  }

  useVerifiedMultisig(callback: any): any {
    return async (subject: string, data: { token: string }): Promise<string> => {
      const multisig = subject.split(".").pop(); // last item of subject is lock name
      if (!isEthAddress(multisig)) {
        const authRes = this.badSubject(
          `Subject's last item isn't a valid eth address: ${subject}`,
        );
        if (authRes) {
          this.log.error(
            `Auth failed (${authRes.err}) but we're just gonna ignore that for now..`,
          );
          return callback(multisig, data);
        }
      }
      const channel = await this.channelRepo.findByMultisigAddress(multisig);
      this.log.info(`Got channel ${multisig}: ${JSON.stringify(channel)}`);
      if (!channel) {
        this.log.error(`Acquiring a lock for a multisig w/out a channel: ${subject}`);
        return callback(multisig, data);
      }
      const { userPublicIdentifier } = channel;
      const xpubAddress = getAuthAddressFromXpub(userPublicIdentifier);
      this.log.debug(`Got address ${xpubAddress} from xpub ${userPublicIdentifier}`);
      const authRes = this.verifySig(xpubAddress, data);
      if (authRes) {
        this.log.error(
          `Auth failed (${authRes.err}) but we're just gonna ignore that for now..`,
        );
      }
      return callback(multisig, data);
    };
  }

  useUnverifiedMultisig(callback: any): any {
    return async (subject: string, data: { token: string }): Promise<string> => {
      const multisig = subject.split(".").pop(); // last item of subject is lock name
      if (!isEthAddress(multisig)) {
        return this.badSubject(`Subject's last item isn't a valid eth address: ${subject}`);
      }
      return callback(multisig, data);
    };
  }

  // TODO: deprecate
  useUnverifiedHexString(callback: any): any {
    return async (subject: string, data: { token: string }): Promise<string> => {
      const lockName = subject.split(".").pop(); // last item of subject is lock name
      if (!isHexString(lockName)) {
        return this.badSubject(`Subject's last item isn't a valid hex string: ${subject}`);
      }
      return callback(lockName, data);
    };
  }

  useAdminToken(callback: any): any {
    // get token from subject
    return async (subject: string, data: { token: string }): Promise<string> => {
      // // verify token is admin token
      const { token } = data;
      if (token !== process.env.INDRA_ADMIN_TOKEN) {
        return this.badToken(`Unrecognized admin token: ${token}.`);
      }
      return callback(data);
    };
  }

  useAdminTokenWithPublicIdentifier(callback: any): any {
    // get token from subject
    return async (subject: string, data: { token: string }): Promise<string> => {
      // // verify token is admin token
      const { token } = data;
      if (token !== process.env.INDRA_ADMIN_TOKEN) {
        return this.badToken(`Unrecognized admin token: ${token}.`);
      }

      // Get & validate xpub from subject
      const xpub = subject.split(".").pop(); // last item of subscription is xpub
      if (!xpub || !isXpub(xpub)) {
        return this.badSubject(`Subject's last item isn't a valid xpub: ${subject}`);
      }
      return callback(xpub, data);
    };
  }

  useUnverifiedPublicIdentifier(callback: any): any {
    return async (subject: string, data: { token: string }): Promise<string> => {
      // Get & validate xpub from subject
      const xpub = subject.split(".").pop(); // last item of subscription is xpub
      if (!xpub || !isXpub(xpub)) {
        return this.badSubject(`Subject's last item isn't a valid xpub: ${subject}`);
      }
      return callback(xpub, data);
    };
  }
}
