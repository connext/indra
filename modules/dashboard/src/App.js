import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Route } from "react-router-dom";

import "./App.css";
import Home from "./components/Home";
import Debug from "./components/Debug";
import Stats from "./components/Stats";
import DashboardMessaging from "./lib/messaging";
import {
  Modal,
  TextField,
  Button,
  Grid,
  InputAdornment,
  Typography,
  styled,
  CircularProgress,
} from "@material-ui/core";

const TopGrid = styled(Grid)({
  display: "flex",
  flexWrap: "wrap",
  width: "100%",
  height: "100%",
  justifyContent: "center",
  alignItems: "center",
});
const TokenModal = styled(Modal)({});

const TokenModalGrid = styled(Grid)({
  display: "flex",
  alignSelf: "center",
  width: "50%",
  marginLeft: "25%",
  backgroundColor: "#ffffff",
  alignItems: "center",
  justifyContent: "center",
});

const ModalTextField = styled(TextField)({
  width: "90%",
});

const ErrorTypography = styled(Typography)({
  color: "red",
});

const env = {
  adminToken: process.env.REACT_APP_INDRA_NATS_TOKEN || "foo",
  nodeUrl:
    process.env.REACT_APP_NODE_URL_OVERRIDE ||
    `${window.location.origin.replace(/^http/, "ws")}`,
  urlPrefix: process.env.PUBLIC_URL || "",
};

// env.nodeUrl = "wss://staging.indra.connext.network";
// env.adminToken = "foo";

const App = () => {
  const [messaging, setMessaging] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [inputToken, setInputToken] = useState("");
  const [errorText, setErrorText] = useState("");
  const [loading, setLoading] = useState(false);

  // If no mnemonic, create one and save to local storage
  useEffect(() => {
    (async () => {
      let token = localStorage.getItem("token");
      if (!token) {
        setModalOpen(true);
        return;
      } else {
        console.debug(`creating and connecting messaging service...`);
        const messaging = new DashboardMessaging(env.nodeUrl, token, 5);
        await messaging.connect();
        setMessaging(messaging);
        console.debug(`messaging set!`, messaging);
      }
    })();
  }, []);

  const getMessagingWithToken = async token => {
    setLoading(true);
    if (!token) {
      setErrorText("Please enter a token");
      setLoading(false);
      return;
    }
    try {
      console.log(env.nodeUrl);
      const messaging = new DashboardMessaging(env.nodeUrl, token, 5);
      await messaging.connect();
      setMessaging(messaging);
      console.log(`messaging set!`, messaging);
      localStorage.setItem("token", token);
      setLoading(false);
      setModalOpen(false);
    } catch (e) {
      setErrorText("Incorrect token");
      setLoading(false);
    }
  };

  return (
    <Router>
      <Route
        exact
        path={`${env.urlPrefix}/`}
        render={props => (
          <TopGrid>
            <TokenModal open={modalOpen}>
              <TokenModalGrid>
                <ModalTextField
                  id="outlined"
                  label="Admin Token"
                  type="string"
                  value={inputToken}
                  onChange={evt => setInputToken(evt.target.value)}
                  margin="normal"
                  variant="outlined"
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <Button
                          variant="contained"
                          onClick={async () => {
                            await getMessagingWithToken(inputToken);
                          }}
                        >
                          {loading ? <CircularProgress color="primary" /> : "Submit"}
                        </Button>
                      </InputAdornment>
                    ),
                  }}
                />
                <ErrorTypography>{errorText}</ErrorTypography>
              </TokenModalGrid>
            </TokenModal>
            <Home {...props} prefix={env.urlPrefix} />
          </TopGrid>
        )}
      />
      {messaging && (
        <Route
          path={`${env.urlPrefix}/debug`}
          render={props => <Debug {...props} prefix={env.urlPrefix} messaging={messaging} />}
        />
      )}
      {messaging && (
        <Route
          path={`${env.urlPrefix}/stats`}
          render={props => <Stats {...props} prefix={env.urlPrefix} messaging={messaging} />}
        />
      )}
    </Router>
  );
};

export default App;
