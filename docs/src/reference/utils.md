
# @connext/utils

**Exported Classes:**
 - [`ChannelSigner`](#channelsigner)



## Classes


### ChannelSigner

An extended ethers `Signer` interface configured to add support for encrypting/decrypting messages and remove support for signing generic Ethereum messages.

```typescript
import { Signer } from "ethers";

class ChannelSigner extends Signer{
  constructor(privateKey: string, ethProviderUrl?: string);

  // Properties
  address: string;
  publicKey: string;
  publicIdentifier: string;

  // Methods
  decrypt(message: string): Promise<string>;
  encrypt(message: string, publicKey: string): Promise<string>;
  signMessage(message: string): Promise<string>;
}
```


