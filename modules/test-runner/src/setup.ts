import { after, before } from "mocha";
import { connectNats, closeNats, fundEthWallet } from "./util";

before(async () => {
  await connectNats();
  await fundEthWallet();
});

after(async () => {
  closeNats();
});
