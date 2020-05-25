import { signReceipt } from "./attestations";
import { Wallet } from "ethers";
import { hexlify, joinSignature } from "ethers/utils";
import * as bs58 from "bs58";

describe("Attestations", () => {
  test("attestations are correct", async () => {
    let mnemonic = "coyote tattoo slush ball cluster culture bleak news when action cover effort";

    let receipt = {
      requestCID: "0xd902c18a1b3590a3d2a8ae4439db376764fda153ca077e339d0427bf776bd463",
      responseCID: "0xbe0b5ae5f598fdf631133571d59ef16b443b2fe02e35ca2cb807158069009db9",
      subgraphID: hexlify(bs58.decode("QmTXzATwNfgGVukV1fX2T6xw9f6LAYRVWpsdXyRWzUR2H9").slice(2)),
    };

    let signer = Wallet.fromMnemonic(mnemonic);
    let attestation = await signReceipt(
      receipt,
      1,
      "0x0000000000000000000000000000000000000000",
      signer.privateKey,
    );

    expect(attestation).toStrictEqual({
      requestCID: receipt.requestCID,
      responseCID: receipt.responseCID,
      subgraphID: receipt.subgraphID,
      signature: joinSignature({
        v: 28,
        r: "0x5eb1e2428518b5fac8904e3239b6bda39cd52ecd054b271b94ae6145976c4ef3",
        s: "0x38f0f5c725bef4c799d440a2b846d09ab268b23fd363964445643267d789cfd2",
      }),
    });
  });
});
