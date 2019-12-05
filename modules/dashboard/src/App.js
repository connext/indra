import React, { useEffect, useState } from "react";
import "./App.css";
import { BrowserRouter as Router, Route } from "react-router-dom";
import Home from "./components/Home";
import Debug from "./components/Debug";
import Stats from "./components/Stats";
import DashboardMessaging from "./lib/messaging";

// const nc = await connect({ servers: ["wss://daicard.io/api/messaging"] });

const env = {
  authToken: process.env.REACT_APP_INDRA_NATS_TOKEN || "foo",
  nodeUrl:
    process.env.REACT_APP_NODE_URL_OVERRIDE ||
    `${window.location.origin.replace(/^http/, "ws")}/api/messaging`,
  urlPrefix: process.env.PUBLIC_URL || "",
};

const App = () => {
  const [messaging, setMessaging] = useState(null);

  useEffect(() => {
    (async () => {
      console.debug(`creating and connecting messaging service...`);
      const messaging = new DashboardMessaging(env.nodeUrl, env.authToken, 5);
      await messaging.connect();
      setMessaging(messaging);
      console.debug(`messaging set!`, messaging);
    })();
  }, []);

  return (
    <Router>
      <Route
        exact
        path={`${env.urlPrefix}/`}
        render={props => <Home {...props} prefix={env.urlPrefix} />}
      />
      <Route
        path={`${env.urlPrefix}/debug`}
        render={props => (
          <Debug {...props} prefix={env.urlPrefix} messaging={messaging} />
        )}
      />
      <Route
        path={`${env.urlPrefix}/stats`}
        render={props => (
          <Stats {...props} prefix={env.urlPrefix} messaging={messaging} />
        )}
      />
    </Router>
  );
};

export default App;
