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
    || 'foo',
  // nodeUrl: process.env.REACT_APP_NODE_URL_OVERRIDE
  //   || `${window.location.origin.replace(/^http/, "ws")}/api/messaging`,
  nodeUrl: process.env.REACT_APP_NODE_URL_OVERRIDE
  || `ws://localhost:3000/api/messaging`,
  urlPrefix: process.env.PUBLIC_URL
    || '',
}

const App = props => {
  const [messaging, setMessaging] = useState(null);

  console.log("PREFIX:",env.urlPrefix)

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
      <Route exact path={`${env.urlPrefix}/`} render={props => <Home {...props} prefix={env.urlPrefix} />} />
      <Route path={`${env.urlPrefix}/debug`} render={props => <Debug {...props} prefix={env.urlPrefix} messaging={messaging} token={env.authToken}/>} />
      <Route path={`${env.urlPrefix}/stats`} render={props => <Stats {...props} prefix={env.urlPrefix} messaging={messaging} token={env.authToken}/>} />
    </Router>
  );
};

export default App;
