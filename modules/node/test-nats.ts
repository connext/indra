import { connect } from "ts-nats";

async function start(): Promise<void> {
  const nc = await connect({ servers: ["nats://localhost:4222"] });
  // const helloMsg = await nc.request(
  //   "hello",
  //   1000,
  //   JSON.stringify({ data: "Hello, Indra", id: "myid" }),
  // );
  // console.log("helloMsg: ", helloMsg);
  const history = await nc.request(
    "transfer.get-history.xpub6DXwZMmWUq4bRZ3LtaBYwu47XV4Td19pnngok2Y7DnRzcCJSKCmD1AcLJDbZZf5dzZpvHqYzmRaKf7Gd2MV9qDvWwwN7VpBPNXQCZCbfyoK",
    1000,
    JSON.stringify({ id: "myid2" }),
  );
  console.log("history: ", history);
  // await nc.subscribe("swap-rate.>", (err: any, msg: any) => {
  //   if (err) {
  //     console.log(err);
  //   } else {
  //     console.log(msg);
  //   }
  // });
}

start();
