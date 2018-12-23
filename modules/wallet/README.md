# This branch is intended to be run as part of the Indra repo.

See that project root for build/deployment instructions.

## To link w the connext-client module that's under construction

 1. `bash ops/link.sh`: to clone the `.git` folder from github.com/bohendo/connext-client#indra-experimental, `yarn link` that repo to the global `node_modules`, and then `yarn link connext` into this project. 

**Important node**, the above will setup connext-client to be a subtree of the current repo. That means there will be a repo inside a repo. `git status` from the project root will return the status of the `payment-starter-kit` project while `git status` from inside connext-client will return the status of the `connext-client` project. This gives us the freedom to push, pull & merge changes to this connext client from other repos. We can make changes to connext-client and then `cd connext-client && git add . && git commit -m "message" && git push` and those changes will be available to be pulled & merged by the hub.

 2. `cd connext-client && yarn install && cd ..`: Should also run build stuff for connext module to transpile the source & create stuff in `connext-client/dist/`. This is where the rest of the payment app will be importing from.

 3. `yarn build`: to check for build-time errors, hopefully this will be uneventful

 4. `yarn start`: to check for run-time errors & start developing

Development is easiest if we have a typescript watcher watching both parts of the project:

 - `node_modules/.bin/tsc --watch`
 - `cd connext-client && ./node_modules/.bin/tsc --watch`

## Available Scripts

Rename to connext.js?

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.<br>
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.<br>
You will also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.<br>
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.<br>
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.<br>
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can’t go back!**

If you aren’t satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (Webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you’re on your own.

You don’t have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn’t feel obligated to use this feature. However we understand that this tool wouldn’t be useful if you couldn’t customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).
