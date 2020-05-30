
# How To Deploy an Indra Node

Lets say you want to deploy an Indra payment node to `https://indra.example.com` (we'll call this url `$DOMAINNAME`)

First step: get a server via AWS or DigitalOcean or hardware at home. For best results, use the most recent LTS version of Ubuntu. If using DigitalOcean, make sure you toggle on the VPC network when instantiating a droplet. Note this new server's IP address (we'll call it `$SERVER_IP`). Make sure it's able to connect to the internet via ports 80, 443, 4221, and 4222 (no action required on DigitalOcean, Security Group config needs to be setup properly on AWS).

Set up DNS so that `$DOMAINNAME` points to this server's IP address. If you're using CloudFlare name servers, turn on CloudFlare's built-in SSL support & make sure it's set to "Full (strict)".

Every Indra node needs access to a hot wallet, you should generate a fresh mnemonic for your node's wallet that isn't used anywhere else. You can generate a new mnemonic from a node console with ethers by doing something like this: `require('ethers').Wallet.createRandom()`.

Save this mnemonic somewhere safe, copy it to your clipboard, and then run:

```bash
SSH_KEY=$HOME/.ssh/id_rsa bash ops/setup-ubuntu.sh $SERVER_IP
```

(`$HOME/.ssh/id_rsa` is the default `SSH_KEY`, if this is what you're using then no need to supply it)

If this is a fresh Ubuntu server from DigitalOcean or AWS then the above script should:
 - configure an "ubuntu" user and disable root login (if enabled)
 - give an additional ssh public key login access if key specified by the `PUB_KEY` env var is available (defaults to `$HOME/.ssh/autodeployer.pub`)
 - install docker & make & other dependencies
 - upgrade everything to the latest version
 - save your mnemonic in a docker secret called `indra_mnemonic`
 - reboot

Note: this script is idempotent aka you can run it over and over again w/out causing any problems. In fact, re-running it every month or so will help keep things up-to-date (you can skip inputting the mnemonic on subsequent runs).

If you already have a server with docker & make installed, there's another helper script you can use to easily load your mnemonic: `bash ops/save-secret.sh`. Run this on your prod server & copy/paste in your mnemonic.

For convenience's sake, we recommend adding an entry to your ssh config to easily access this server. Add something that looks like the following to `$HOME/.ssh/config`:

```bash
Host new-indra
  Hostname $SERVER_IP
  User ubuntu
  IdentityFile ~/.ssh/id_rsa
  ServerAliveInterval 120
```

Now you can login to this server with just `ssh new-indra`. Once the server wakes up again after rebooting at the end of `ops/setup-ubuntu`, login to finish setup.

We need to add a couple env vars before launching our indra node. We'll be pulling from the public default prod-mode env vars & updating a couple as needed.

```bash
cp prod.env .env
```

Ensure you've added correct values for two important env vars: `INDRA_DOMAINNAME` and `INDRA_ETH_PROVIDER`.

Upload the prod env vars to the indra server. If you're using a custom address book, upload that too:

```bash
scp .env new-indra:~/indra/
scp address-book.json new-indra:~/indra/
```

Login to your prod server then run the following to launch your Indra node:

```bash
cd indra
git checkout master # staging is the default branch. It's cutting edge but maybe buggy.
make restart-prod
```

The above will download & run docker images associated with the commit/release you have checked out. If you want to launch a specific version of indra, checkout that version's tag & restart:

```bash
git checkout indra-6.0.8 && make restart-prod
```
