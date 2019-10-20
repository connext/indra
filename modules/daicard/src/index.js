import { MuiThemeProvider, createMuiTheme } from "@material-ui/core/styles";
import React from "react";
import ReactDOM from "react-dom";

import App from "./App";
import "./index.css";
import * as serviceWorker from "./serviceWorker";

const theme = createMuiTheme({
  palette: {
    primary: {
      main: "#FCA311"
    },
    accent:{
      main:"#002868"
    },
    secondary: {
      main: "#282b2e",
      light: "#1E96CC"
    }
  },
  typography: {
    useNextVariants: true,
  }
});

ReactDOM.render(
  <MuiThemeProvider theme={theme}>
    <App />
  </MuiThemeProvider>,
  document.getElementById("root")
);

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: http://bit.ly/CRA-PWA
serviceWorker.unregister();
