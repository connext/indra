import React from "react";
import { Grid, Typography, styled } from "@material-ui/core";

const TopGrid = styled(Grid)({
  display: "flex",
  flexWrap: "wrap",
  flexDirection: "row",
  width: "100%",
  height: "100%",
  justifyContent: "center",
  alignItems: "center",
})

const StatTypography = styled(Typography)({
  textAlign: "center",
  width: "90%",
  fontSize: "24px",
  color: "#002868",
  textDecoration: "none",
})

function StatsGas({ classes }) {
  return (
    <TopGrid container>
      <StatTypography >Hello</StatTypography>
      <StatTypography >World</StatTypography>
    </TopGrid>
  );
}


export default StatsGas;
