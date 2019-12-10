import React, { useState } from "react";
import Grid from "@material-ui/core/Grid";
import Button from "@material-ui/core/Button";
import { IncorrectProxyFactoryAddress } from "./IncorrectProxyFactoryAddress";

export const GetIncorrectProxyFactoryAddress = ({ messaging }) => {
  const [incorrectProxyFactoryAddressData, setIncorrectProxyFactoryAddressData] = useState([]);
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
      {incorrectProxyFactoryAddressData.length > 0 && (
        <IncorrectProxyFactoryAddress tableData={incorrectProxyFactoryAddressData} />
      )}
    </>
  );
};

export const FixIncorrectProxyFactoryAddress = ({ messaging }) => {
  const [fixed, setFixed] = useState();
  const [disabled, setDisabled] = useState(false);

  const fixIncorrectProxyFactoryAddresses = async () => {
    setDisabled(true);
    try {
      const fixed = await messaging.fixChannelsIncorrectProxyFactoryAddress();
      console.log("fixed: ", fixed);
      setFixed(fixed);
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
    </Grid>
  );
};
