# Card

A simple offchain wallet, hosted in the browser, which utilizes Indra payment channels. Inspired by the SpankCard and Austin Griffith's burner wallet.

See it live at: https://daicard.io

## Contents
- [Overview](#overview)
    - [Local Development](#local-development)
    - [Developing Client Alongside](#developing-connext-client-alongside)
- [Integrating into your App](#integrating-into-your-app)
    - [NPM Package](#npm-package)

## Overview

### Local development

Prerequisites
 - Node 9+
 - Docker
 - Make

1. Make sure you have indra running locally. Check out the instructions in the [indra repo](https://github.com/ConnextProject/indra).

TL;DR run:

```
git clone https://github.com/ConnextProject/indra.git
cd indra
make start
```

2. Deploy

From the card's project root (eg `git clone https://github.com/ConnextProject/card.git && cd card`), run one of the following:

Using a containerized webpack dev server (recommended):
```
make start
```

Using a local webpack dev server:
```
npm install
npm start
```

The above step will take a while to completely finish because the webpack dev server takes a long time to wake up. Monitor it with:

```
bash ops/logs.sh server
```

3. Check it out

 - If you started with `npm start`, browse to `http://localhost:3000`
 - If you started with `make start`, browse to `http://localhost`

4. Run tests

During local development, start the test watcher with:

```
npm run start-test
```

This will start an ongoing e2e tester that will re-run any time the tests are changed. Works well with webpack dev server but you'll have to manually re-trigger the tests after changing the card's source code.

You can also run the more heavy-duty e2e tests that will be run as part of CI integration with:

```
npm run test
```

### Developing Connext Client Alongside

Assuming indra has been cloned & started in the parent directory, run the following from the card repo:

```
bash ops/link-connext.sh
```

Sometimes the connext link gets screwy, especially if you update the connext package.json. To reset the connext link to a clean slate, do:

```
bash ops/link-connext.sh reset
```

The above will create a local copy of the connext client that you can mess with. None of you changes in this local client will be reflected in indra, make sure to copy over any changes worth keeping.

## Integrating into your App

This card is a simple implementation of the Connext Client package. If you'd like to integrate p2p micropayments into your application, you have a few options:

(1) Simply embed the card in your app or link to it for payments
(2) Build a more "bespoke" integration to fit your needs

In this section, we'll describe how the Client is integrated into the card, as well as the steps that you'll need to take to build a seamless UX.

### NPM package

The Connext client is a lightweight NPM package that can be found here:

https://www.npmjs.com/package/@connext/client

Installation:

`npm i connext`

`import { connect } from "@connext/client";`

You can find documentation on integrating and running the client at https://docs.connext.network.
