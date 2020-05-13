import { after, before } from "mocha";
import { connectDb, disconnectDb, connectNats, closeNats, fundEthWallet } from "./util";

before(async () => {
  await connectDb();
  await connectNats();
  await fundEthWallet();
});

after(async () => {
  await disconnectDb();
  closeNats();
});
