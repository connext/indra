import React, { useState } from "react";
import Button from "@material-ui/core/Button";
import Grid from "@material-ui/core/Grid";
import Snackbar from "@material-ui/core/Snackbar";

export const RepairCriticalAddresses = ({ messaging }) => {
  const [repaired, setRepaired] = useState({ repairedChannels: [] });
  const [disabled, setDisabled] = useState(false);
  const [open, setOpen] = React.useState(false);

  const repairIncorrectCriticalAddresses = async () => {
    setDisabled(true);
    try {
      const repairedResponse = await messaging.repairCriticalAddresses();
      console.log("repairedResponse: ", repairedResponse);
      setRepaired(repairedResponse);
      setOpen(true);
    } finally {
      setDisabled(false);
    }
  };

  return (
    <Grid item xs={12}>
      <Button
        color="primary"
        variant="contained"
        onClick={repairIncorrectCriticalAddresses}
        disabled={disabled}
        fullWidth
      >
        Ask Node To Repair All Channels With Incorrect Critical Addresses
      </Button>
      <Snackbar
        open={open}
        autoHideDuration={6000}
        message={
          `${repaired.fixed ? repaired.fixed.length : 0} Channels repaired 🏗  ${repaired.broken ? repaired.broken.length : 0} still broken`
        }
      />
    </Grid>
  );
};
