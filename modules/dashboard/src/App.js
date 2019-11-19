import React, { useEffect, useState } from "react";
import logo from "./logo.svg";
import "./App.css";
import { BrowserRouter as Router, Route } from "react-router-dom";
import Home from "./components/Home";
import Debug from "./components/Debug";
import Stats from "./components/Stats";
import { connect } from "ts-nats";
import { MessagingServiceFactory } from "@connext/messaging";

// const nc = await connect({ servers: ["wss://daicard.io/api/messaging"] });

const env = {
  authToken: process.env.REACT_APP_INDRA_NATS_TOKEN
    || 'foobar',
  nodeUrl: process.env.REACT_APP_NODE_URL_OVERRIDE
    || `${window.location.origin.replace(/^http/, "ws")}/api/messaging`,
  urlPrefix: process.env.REACT_APP_URL_PREFIX
    || '',
}

const App = props => {
  const [messaging, setMessaging] = useState(null);

  useEffect(() => {
    (async () => {
      const messagingFactory = new MessagingServiceFactory({
        logLevel: 5,
        messagingUrl: env.nodeUrl, // nodeUrl
      });
      const messaging = messagingFactory.createService("messaging");
      await messaging.connect();
      setMessaging(messaging)
      console.log(messaging)
    })();
  }, []);

  return (
    <Router>
      <Route exact path={`${env.urlPrefix}/`} render={props => <Home {...props} />} />
      <Route path={`${env.urlPrefix}/debug`} render={props => <Debug {...props} messaging={messaging} token={env.authToken}/>} />
      <Route path={`${env.urlPrefix}/stats`} render={props => <Stats {...props} messaging={messaging} token={env.authToken}/>} />
    </Router>
  );
};

export default App;
