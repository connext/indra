import React, { useState } from "react";
import Grid from "@material-ui/core/Grid";
import Button from "@material-ui/core/Button";
import Snackbar from '@material-ui/core/Snackbar';
import { IncorrectProxyFactoryAddress } from "./IncorrectProxyFactoryAddress";

export const GetIncorrectProxyFactoryAddress = ({ messaging }) => {
  const [incorrectProxyFactoryAddressData, setIncorrectProxyFactoryAddressData] = useState();
  const [disabled, setDisabled] = useState(false);

  const getChannelsIncorrectProxyFactoryAddress = async () => {
    setDisabled(true);
    try {
      const channels = await messaging.getChannelsIncorrectProxyFactoryAddress();
      console.log("channels: ", channels);
      const concatenated = channels.incorrectProxyAddress.concat(channels.noProxyAddress);
      setIncorrectProxyFactoryAddressData(concatenated);
    } finally {
      setDisabled(false);
    }
  };

  return (
    <>
      <Grid item xs={12}>
        <Button
          color="primary"
          variant="contained"
          onClick={getChannelsIncorrectProxyFactoryAddress}
          disabled={disabled}
          fullWidth
        >
          Get Channels With Incorrect Proxy Address
        </Button>
      </Grid>
      {Array.isArray(incorrectProxyFactoryAddressData) && (
        <IncorrectProxyFactoryAddress tableData={incorrectProxyFactoryAddressData} />
      )}
    </>
  );
};

export const FixIncorrectProxyFactoryAddress = ({ messaging }) => {
  const [fixed, setFixed] = useState({ fixedChannels: [] });
  const [disabled, setDisabled] = useState(false);
  const [open, setOpen] = React.useState(false);

  const fixIncorrectProxyFactoryAddresses = async () => {
    setDisabled(true);
    try {
      const fixedResponse = await messaging.fixChannelsIncorrectProxyFactoryAddress();
      console.log("fixedResponse: ", fixedResponse);
      setFixed(fixedResponse);
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
        onClick={fixIncorrectProxyFactoryAddresses}
        disabled={disabled}
        fullWidth
      >
        Fix Channels With Incorrect Proxy Address
      </Button>
      <Snackbar
        open={open}
        autoHideDuration={6000}
        message={`Fixed ${fixed.fixedChannels.length} channels 🏗`}
      />
    </Grid>
  );
};
