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

const App = props => {
  const [messaging, setMessaging] = useState(null);

  useEffect(() => {
    (async () => {
      const messagingFactory = new MessagingServiceFactory({
        messagingUrl: "ws://localhost:3000/api/messaging", // nodeUrl
      });
      const messaging = messagingFactory.createService("messaging");
      await messaging.connect();
      setMessaging(messaging)
      console.log(messaging)
    })();
  }, []);


  return (
    <Router>
      <Route exact path="/" render={props => <Home {...props} />} />
      <Route path="/debug" render={props => <Debug {...props} messaging={messaging} />} />
      <Route path="/stats" render={props => <Stats {...props} messaging={messaging} />} />
    </Router>
  );
};

export default App;
