import { connect } from "ts-nats";

async function start(): Promise<void> {
  const nc = await connect({ servers: ["nats://localhost:4222"] });
  const helloMsg = await nc.request(
    "hello",
    1000,
    JSON.stringify({ data: "Hello, Indra", id: "myid" }),
  );
  console.log("helloMsg: ", helloMsg);
  // const lockMsg = await nc.request(
  //   "lock.acquire.0xdeadbeef",
  //   1000,
  //   JSON.stringify({ id: "myid2" }),
  // );
  // console.log("lockMsg: ", lockMsg);
  // console.log(`Waiting 2 seconds`);
  // await new Promise(res => setTimeout(() => res(), 2000));
  // const lockValue = JSON.parse(lockMsg.data).response;
  // console.log(`unlocking with ${lockValue}`);
  // const unlockMsg = await nc.request(
  //   "lock.release.0xdeadbeef",
  //   1000,
  //   JSON.stringify({ id: "myid2", lockValue }),
  // );
  // console.log("unlockMsg: ", unlockMsg);
  const restoreMsg = await nc.request(
    "channel.restore-states.xpub6E1hXKHGoaAeGgBS4bwqEhih3QCuJgVvixMBUGKW7RhpE4k2qwRgKi8G2Ai4qFNUZVa5AALSgvNuu12Q6BYoBRDnvB2a63udUXSgehMVtUd",
    1000,
    JSON.stringify({ id: "myid2" }),
  );
  console.log("restoreMsg: ", restoreMsg);
  // await nc.subscribe("swap-rate.>", (err: any, msg: any) => {
  //   if (err) {
  //     console.log(err);
  //   } else {
  //     console.log(msg);
  //   }
  // });
}

start();
