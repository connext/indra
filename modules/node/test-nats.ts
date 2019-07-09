import { connect } from "ts-nats";

async function start(): Promise<void> {
  const nc = await connect({ servers: ["nats://localhost:4222"] });
  const helloMsg = await nc.request(
    "hello",
    1000,
    JSON.stringify({ data: "Hello, Indra", id: "myid" }),
  );
  console.log("helloMsg: ", helloMsg);
  const appMsg = await nc.request("app-registry", 1000, JSON.stringify({ id: "myid2" }));
  console.log("appMsg: ", appMsg);
  await nc.subscribe("exchange-rate", (err: any, msg: any) => {
    if (err) {
      console.log(err);
    } else {
      console.log(msg);
      console.log(msg.data);
    }
  });
}

start();
