import React, { useState } from "react";
import Grid from '@material-ui/core/Grid';
import Button from '@material-ui/core/button';
import { styled } from '@material-ui/core/styles';
import { IncorrectProxyFactoryAddress } from "./Admin/IncorrectProxyFactoryAddress";

const RootGrid = styled(Grid)({
  flexGrow: 1,
  padding: "5%",
});

const Admin = ({ messaging }) => {
  const [incorrectProxyFactoryAddressData, setIncorrectProxyFactoryAddressData] = useState([]);

  const getChannelsIncorrectProxyFactoryAddress = async () => {
    const channels = await messaging.getChannelsIncorrectProxyFactoryAddress();
    console.log("channels: ", channels);
    const concatenated = channels.incorrectProxyAddress.concat(channels.noProxyAddress);
    setIncorrectProxyFactoryAddressData(concatenated);
  };

  return (
    <RootGrid container spacing={3}>
      <Grid item xs={12}>
        <Button
          color="primary"
          variant="contained"
          onClick={getChannelsIncorrectProxyFactoryAddress}
        >
          Get Channels With Incorrect Proxy Address
        </Button>
      </Grid>
      {incorrectProxyFactoryAddressData.length > 0 && (
        <IncorrectProxyFactoryAddress tableData={incorrectProxyFactoryAddressData} />
      )}
    </RootGrid>
  );
};

export default Admin;
