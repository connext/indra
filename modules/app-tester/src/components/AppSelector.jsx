import React from "react";
import InputLabel from "@material-ui/core/InputLabel";
import MenuItem from "@material-ui/core/MenuItem";
import Select from "@material-ui/core/Select";
import { Grid } from "@material-ui/core";

const apps = [
  { appName: "ETH Unidirectional Transfer", appContractAddress: "0x", id: 0 },
  { appName: "Swap", appContractAddress: "0x", id: 1 },
];

export default function AppSelector() {
  const [selectedApp, setSelectedApp] = React.useState({
    appDefinitionId: "",
  });

  function handleChange(event) {
    setSelectedApp(oldValues => ({
      ...oldValues,
      appDefinitionId: event.target.value,
    }));
  }
  return (
    <>
      <Grid item xs={6}>
        <InputLabel htmlFor="app-select">Select an App</InputLabel>
        <Select
          value={selectedApp.appDefinitionId}
          onChange={handleChange}
          inputProps={{
            name: "app-select",
            id: "app-select",
          }}
          fullWidth
        >
          {apps.map(app => (
            <MenuItem value={app.appName} key={app.id}>
              {app.appName}
            </MenuItem>
          ))}
        </Select>
      </Grid>
      <Grid item xs={6} />
    </>
  );
}
