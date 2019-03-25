Swagger Documentation
==================================
https://app.swaggerhub.com/apis/spankchain/service-payments/0.0.1-oas3

Setting up Development Environment
==================================

1. Install packages::

   $ yarn install

2. Copy ``development/env-vars`` to ``.env-vars`` and make changes as appropriate

3. Copy ``database.json-skeleton`` to ``database.json`` and make changes as appropriate

4. Create Postgres databases::

   $ createdb sc-hub
   $ createdb sc-hub-test


Running Tests
=============

1. Run the tests with::

   $ ./migrate-and-test.sh

Creating Migrations
===================

To create a migration, run::

   db-migrate create YOUR_MIGRATION_NAME --sql-file 

Then edit the SQL files in ``migrations/sqls/``

Adding Feature Flags
====================

1. Create a new column in the feature_flags table
2. Create a new field in the `FeatureFlags` interface
3. Define a default value in the `DEFAULT_FLAGS` constant
4. Update the inflateRowDefaults method to include the flag in its return value

Feature flags can be queried by making a GET request to /featureflags.

Running with Local Testnet
==========================

1. Setup ganache::

   ./development/ganache-reset

2. Start ganache::

   ./development/ganache-run

3. Reset the hub's database::

   ./development/hub-reset

4. Start the hub::

   ./development/hub-run

5. Add these to ``/etc/hosts``::

   127.0.0.1       spankhub
   127.0.0.1       spankfura

6. Run the Vynos test harness like this::

   ./development/vynos-harness

  And access the harness from: http://localhost:9999

7. From the repository root (ie, ``cd ../`` if you're in the ``hub/``
   directory)::

   HUB_URL=http://spankhub:8080 npm start

Other helpful things:

``./development/truffle``: run truffle against the local ganache. Hint::

   ./development/truffle console

Fill the contract with ETH and tokens.

``./development/truffle exec ../../fillContract.js``: Sends 5 ETH and 1000 HST (i.e. BOOTY) to the deployed contract

``./development/send-eth ETH ADDRESS``: Sends ``ETH`` (ex, 6.9) to ``ADDRESS``

``./development/send-booty BOOTY ADDRESS``: Sends ``BOOTY`` (ex, 6.9) to ``ADDRESS``


Debugging in VSCode
===================

A VSCode attach configuration is committed to the repo. 

1. Run the hub as normal with the `hub-run` script shown above.

2. Inside VSCode, click the "Debug" menu on the left side bar and find the `Attach (camsite)` configuration.

3. Click the green "play" button to attach to the running node process.

4. Insert breakpoints and view variables!
