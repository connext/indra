import { ColorfulLogger } from "@connext/utils";
import express from "express";
import bodyParser from "body-parser";

let bots = new Set();

const app = express();
app.use(bodyParser.json());
const port = 3333;

const log = new ColorfulLogger("Bot Registry", 3, true);

app.get("/agent", async (req, res) => {
  const botsArray = Array.from(bots);
  log.debug(`Returning botsArray: ${botsArray}`);
  res.json(Array.from(bots));
});

app.post("/agent", async (req, res) => {
  const identifier = req.body.identifier;
  log.info(`Registering identifier: ${identifier}`);
  if (!identifier) {
    return res.status(400).send("No signer specified");
  }
  bots.add(identifier);

  return res.send(identifier);
});

app.delete("/agent", async (req, res) => {
  const identifier = req.body.identifier;
  if (!identifier) {
    log.info(`Clearing registry`);
    bots.clear();
    return res.send();
  }
  log.info(`Removing identifier: ${identifier}`);
  bots.delete(identifier);
  return res.send(identifier);
});

const start = async () => {
  app.listen(port, () => console.log(`Bot registry listening at http://localhost:${port}`));
};
start();
