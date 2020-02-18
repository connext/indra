import Grid from "@material-ui/core/Grid";
import { styled } from "@material-ui/core/styles";
import React from "react";

import { ScanCriticalAddresses } from "./ScanCriticalAddresses";
import { RepairCriticalAddresses } from "./RepairCriticalAddresses";

const RootGrid = styled(Grid)({
  flexGrow: 1,
  padding: "5%",
});

const Admin = ({ messaging }) => {
  return (
    <RootGrid container spacing={3}>
      <RepairCriticalAddresses messaging={messaging} />
      <ScanCriticalAddresses />
    </RootGrid>
  );
};

export default Admin;
