import React from "react";
import { Card, Grid, Typography, styled } from "@material-ui/core";
import { Link } from "react-router-dom";
import PropTypes from "prop-types";

const TopGrid = styled(Grid)({
  display: "flex",
  flexWrap: "wrap",
  flexDirection: "row",
  width: "100%",
  height: "100%",
  justifyContent: "center",
  alignItems: "center",
});

const SelectCard = styled(Card)({
  marginTop: "15%",
  display: "flex",
  height: "320px",
  width: "320px",
  alignItems: "center",
  justifyContent: "center",
  margin: "0% 2% 0% 2%",
  border: "3px solid #002868",
  textDecoration: "none",
  "&:hover": { backgroundColor: "rgba(0,40,104,0.2)" },
});

const CardTypography = styled(Typography)({
  textAlign: "center",
  fontSize: "24px",
  color: "#002868",
  textDecoration: "none",
});

function Home({ classes, prefix }) {
  return (
    <TopGrid container>
      <SelectCard component={Link} to={`${prefix}/debug`}>
        <CardTypography>Debug</CardTypography>
      </SelectCard>
      <SelectCard component={Link} to={`${prefix}/stats`}>
        <CardTypography>Node Stats</CardTypography>
      </SelectCard>
    </TopGrid>
  );
}

export default Home;
