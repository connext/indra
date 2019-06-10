## Description

Indra v2 built with [Nest](https://github.com/nestjs/nest) framework.

## Installation

```bash
$ npm install
```

## Running the app

### Local Development

Note: Update these instructions when Docker setup is live.

#### Install Prerequisites

- Postgres
```bash
# macOS
$ brew install postgresql
```

- NATS
```bash
$ docker pull nats:latest
```

#### Set Up Local Config

Create `.env` in the root by filling in the values from the `.env.example`. At this point, do not worry about the INDRA_NATS_CLUSTER_ID and INDRA_NATS_TOKEN for a local NATS server setup.

#### Run App

- Run Postgres locally
```bash
# macOS
$ brew services start postgresql
```

- Run NATS server locally
```bash
$ docker pull nats:latest
```

- Run Nest app
```bash
# development
$ npm run start

# watch mode
$ npm run start:dev
```

### Production

```bash
$ npm run start:prod
```

## Test

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```