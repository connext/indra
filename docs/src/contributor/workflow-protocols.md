# Workflow Protocols

These are guidelines that the Connext team uses internally to coordinate our development. Suggestions for improvements are welcome!

## Goals

Coordinate several devs working across several time zones to maximize energy spent on useful stuff & minimize wasted work.

"Useful" work to be maximized:
- Building new features
- fixing existing bugs w/out introducing new ones
- Reviewing & providing feedback on work other teammates have done

"Wasteful" work to be minimized:

- Putting out fires caused by new bugs making it to prod
- Re-doing any work that's already been done in another branch
- Fixing new bugs that someone else pushed/merged w/out noticing (the person who introduces a bug probably has more context and is the one who can fix it the fastest)
- Resolving ugly merge conflicts

## Protocols

### Merging code to sync up development (aka CI)
- Merge feature ->  staging frequently. CI must pass before merging and either CD must pass or someone else must have reviewed your code ie `CI && (CD || Review)`
- If staging CD is failing, branch off to fix it (ie don't push commits directly to staging). These CD-hotfix branches should be merged into staging as soon as their ready w/out necessarily waiting for a review.
- Code reviews: at the start of each day, everyone should review and merge other people's "pending review" PRs. Once the "pending review" queue is cleared (or only contains our own PRs), then we're free to work on our own feature branches for the day.

### Deploying to staging/prod (aka CD)
- Note: Staging CD tests a local copy of the code (doesn't use any `@connext/*` npm packages). Master CD tests/deploys connext packages from the npm registry.
- run `bash ops/npm-publish.sh` after staging CD has passed & before merging into master to trigger deploying to prod.
- Don't manually merge staging into master, use this helper script: `bash ops/deploy-indra.sh`. This script will:
  - Detect & abort if any merge conflicts exist between staging & master.
  - Ask you for a version number & run some sanity checks to make sure this version is valid
  - Update the version in the root package.json
  - Merge staging into master & then fast-forward merge master into staging so they're at the same point.
  - Tag & push this new merge commit
- Once master has been pushed, the CD pipeline will automatically be activated.

### Handling Backwards Incompatibilities
- A set of checks are in place to partially check for backwards incompatible changes. As we build out our integration tests, future checks will be more complete.
- There's a version hard-coded in Makefile (look for a variable called `backwards_compatible_version`). If this variable is set to `2.3.20`, for example then the CD test suite for indra  v2.4.5 will test it against both of:
    - `indra_test_runner:2.3.20`
    - `indra_test_runner:2.4.5`
- To get the backwards compatibility check to pass after introducing a breaking change, you must change the `backwards_compatible_version` in Makefile to a compatible version. Ideally, you'd increment the major version eg 2.4.4 ->3.0.0 and then set the `backwards_compatible_version` to 3.0.0 so that, moving forward, all 3.x.x versions are tested for compatibility w 3.0.0. (an automated calculation is commented out but later could be activated to always run test-runner version a.0.0 for any version a.b.c)
- Continuing the wild-west-style version management: if you want to increment 2.4.4 -> 2.4.5 after introducing a breaking change, you can also set `backwards_compatible_version` to be 2.4.5.

### Rolling back prod
Situation: recent prod release is broken & we want to roll-back to an old version
- ssh onto prod server & `cd indra` 
- `git fetch --all`
- `git checkout <target-version>`
- `make restart-prod`
Important note: restarting locally on the server (instead of automatically deploying via CD) means the repo's secrets (see github -> indra -> settings -> secrets) don't get injected. In this situation, the env vars used come from `~/.bashrc` instead so verify that this file has the env vars we need.

### Hot-fixing prod while staging is broken (via CD)
Situation: staging needs some repairs before it's ready to be deployed but there's something urgent we need to fix in prod.
- Create hotfix branch directly off of master & develop/cherry-pick the hotfix here
- Push hotfix branch & make sure it passes all CI/CD steps
- Merge hotfix branch into master if it looks good. 
- Wait ~20 mins for CD to deploy change to prod.
- Check out hotfix & make sure it does what you want. See rollback instructions if it makes things more broken.

### Hot-fixing (skip CD)
Situation: we need to get a change deployed to prod as quickly as possible.
- Write hotfix and push change to master.
- Build/push images: If you have a beefy laptop & fast internet you can do this manually via `make prod && make push-release` (or use `make push-staging` to hotfix staging). Otherwise, it's probably faster to just wait for CD to build/push stuff as part of the build step.
- Once images are pushed:
    -  ssh onto the target server & cd into indra clone
    - `git fetch` `--``all`
    - `git checkout <target commit/release>` 
    - `make restart-prod`
- Check to make sure your hotfix got deployed & does what we expect. Be aware that CD is probably still testing this commit in the background and it will be redeployed maybe 10 mins after you manually deployed it.

### Tagging docker images
Docker images are tagged & pushed automatically during CD, you shouldn't ever have to push/pull images manually.
There are 3 important image tag types:
- Commit tags eg `3dffdc17`, these are built & pushed during the first step of either feature or staging CD. Later steps of feature/staging CD will pull & run tests against these images (and deploy them if staging and tests pass). These are built using local code (ie local modules aren't pulled from the npm registry).
- Release tags eg `1.2.3`, these are built & pushed during the first step of master CD and then tested/deployed during later steps. These images use code from the npm registry, not local code. 
- `latest` tag is always pushed when pushing either commit or release tagged images, these latest images are only used in CD as a cache to make building go faster so if they're corrupted then everything'll be fine but building will take longer. These images will be overwritten frequently so don't pull them expecting anything specific (if you want specific images, use commit-tagged ones). Local images built & run by `make start` will be tagged `latest` so beware: they will be overwritten if you `make pull-latest` (which shouldn't ever be necessary to do during normal dev workflows)
Under the hood: the helper scripts `ops/push-images` and `ops/pull-image` are used by `make` commands, they:
- Both accept one arg: the version to push or pull eg `3dffdc17` or `1.2.3`
- Contain a list of all the images to push/pull (eg node, database, proxy, etc)
- Push latest images too whenever we ask to push commit or release tagged images
- Protect us from overwriting an already pushed image eg can't push images tagged `3dffdc17` more than once.

## Setting up CI/CD

All auto-deployment config can be found in `.github/workflows/`. See [GitHub Actions Documentation](https://help.github.com/en/actions) for docs.

The auto-deployer needs an ssh key so it can login to the prod server, we should use a fresh one instead of re-using existing ssh keys. Run this command to generate a new ssh key pair: `ssh-keygen -t rsa -b 4096 -C "autodeployer" -m pem -f .ssh/autodeployer`. The `ops/setup-ubuntu.sh` script will look for a public key called `$HOME/.ssh/autodeployer.pub` and try to add it to the server's `~/.ssh/authorized_keys`. If we ever change the autodeployer's ssh key, we can add the new keys to our servers by re-running `bash ops/setup-ubuntu.sh $SERVER_IP`.

Env vars controlling CD are store in: GitHub -> Indra Repo -> Settings -> Secrets. The following env vars are used:
- `DOCKER_USER` & `DOCKER_PASSWORD`: Login credentials for someone with push access to the docker repository specified by the `registry` vars at the top of the Makefile & `ops/start-prod.sh`.
- `INDRA_ADMIN_TOKEN`: an admin token for controlling access to sensitive parts of the dashboard.
- `INDRA_AWS_ACCESS_KEY_ID` & `INDRA_AWS_SECRET_ACCESS_KEY`: Login credentials for an AWS storage repo, if provided the database will automatically send DB snapshots to AWS.
- `INDRA_LOGDNA_KEY`: Credentials for LogDNA. If provided, all logs will be sent to this service for further analysis.
- `MAINNET_ETH_PROVIDER` & `RINKEBY_ETH_PROVIDER`: Ethereum RPC Urls eg [Alchemy](https://alchemyapi.io/) or Infura that let us read from/write to blockchain.
- `SSH_KEY`: The autodeployer private ssh key
