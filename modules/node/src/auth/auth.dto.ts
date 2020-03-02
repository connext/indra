import { VerifyNonceDtoType } from "@connext/types"

export class VerifyNonceDto implements VerifyNonceDtoType {
    sig: string;
    xpub: string;
}