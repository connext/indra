import { makeStyles } from "@material-ui/styles";
import { Grid, AppBar, Tabs, Tab, Typography } from "@material-ui/core";
import React from "react";
import { BrowserRouter as Router, Route, Link } from "react-router-dom";

import AppSelector from "./components/AppSelector";
import NavTabs from "./components/NavTabs";

const useStyles = makeStyles(theme => ({
  root: {
    flexGrow: 1,
  },
  paper: {
    padding: theme.spacing(2),
    color: theme.palette.text.secondary,
  },
}));

function TabContainer({ children }) {
  return (
    <Typography component="div" style={{ padding: 8 * 3 }}>
      {children}
    </Typography>
  );
}

export default function App() {
  const classes = useStyles();

  const [selectedTab, setSelectedTab] = React.useState(0);

  function handleTabChange(event, newValue) {
    setSelectedTab(newValue);
  }

  return (
    <Grid container className={classes.root} spacing={3}>
      <Grid item xs={12}>
        <NavTabs handleTabChange={handleTabChange} selectedTab={selectedTab} />
      </Grid>
      {selectedTab === 0 && (
        <TabContainer>Page Three</TabContainer>
      )}
      {selectedTab === 1 && <AppSelector />}
    </Grid>
  );
}
