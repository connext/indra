import React from "react";
import { Tab, AppBar, Tabs } from "@material-ui/core";

function LinkTab(props) {
  return (
    <Tab
      component="a"
      onClick={event => event.preventDefault()}
      {...props}
    />
  );
}

export default function NavTabs({ handleTabChange, selectedTab }) {
  return (
    <AppBar position="static">
      <Tabs variant="fullWidth" value={selectedTab} onChange={handleTabChange}>
        <LinkTab label="Top-Level Functions" href="/" />
        <LinkTab label="Apps" href="/apps" />
      </Tabs>
    </AppBar>
  );
}
