import React from "react";
import Grid from '@material-ui/core/Grid';
import { styled } from '@material-ui/core/styles';
import { GetIncorrectProxyFactoryAddress, FixIncorrectProxyFactoryAddress } from "./IncorrectProxyFactory/IncorrectProxyFactoryAddressView";

const RootGrid = styled(Grid)({
  flexGrow: 1,
  padding: "5%",
});

const Admin = ({ messaging }) => {
  return (
    <RootGrid container spacing={3}>
      <GetIncorrectProxyFactoryAddress messaging={messaging} />
      <FixIncorrectProxyFactoryAddress messaging={messaging} />
    </RootGrid>
  );
};

export default Admin;
