import React, { useEffect, useState } from "react";
import { Grid, Typography, styled } from "@material-ui/core";
import PropTypes from "prop-types";
const axios = require("axios");

const TopGrid = styled(Grid)({
  display: "flex",
  flexWrap: "wrap",
  flexDirection: "column",
  width: "100%",
  height: "100%",
  justifyContent: "flex-start",
  alignItems: "flex-start",
  marginTop: "2%",
  marginLeft: "2%",
});

const StatGrid = styled(Grid)({
  justifyContent: "flex-start",
  marginVertical: "5%",
  flexDirection: "row",
});

const StatTypography = styled(Typography)({
  textAlign: "left",
  fontSize: "24px",
  color: "#002868",
});

const address = {
  mainnet: "0xf3f722f6ca6026fb7cc9b63523bbc6a73d3aad39",
  staging: "0x0f41a9aaee33d3520f853cb706c24ca75cac874e",
  rinkeby: "0x5307b4f67ca8746562a4a9fdeb0714033008ef4a",
};

function DebugNode({ classes }) {
  const [ethBalances, setEthBalances] = useState(null);
  const [daiBalances, setDaiBalances] = useState(null);

  useEffect(() => {
    async function getBalances(addressArr) {
      const balances = await Promise.all(
        addressArr.map(
          async address =>
            await axios.get(
              "http://api.ethplorer.io/getAddressInfo/" + address + "?apiKey=freekey",
            ),
        ),
      );

      var eth = {
        mainnet: balances[0].data.ETH.balance,
        staging: balances[1].data.ETH.balance,
        rinkeby: balances[2].data.ETH.balance,
      };
      var dai = {
        mainnet: balances[0].data.tokens
          ? balances[0].data.tokens[0].balance / 1000000000000000000
          : 0,
        staging: balances[1].data.tokens
          ? balances[1].data.tokens[0].balance / 1000000000000000000
          : 0,
        rinkeby: balances[2].data.tokens
          ? balances[2].data.tokens[0].balance / 1000000000000000000
          : 0,
      };

      setEthBalances(eth);
      setDaiBalances(dai);

      return { eth, dai };
    }
    getBalances(Object.values(address));
  }, []);

  return (
    <TopGrid container>
      <StatGrid>
        <a href={`https://etherscan.io/address/${address.mainnet}`}>Mainnet</a>
        <StatTypography>
          Eth Balance: {ethBalances ? ethBalances.mainnet : "loading..."}
        </StatTypography>
        <StatTypography>
          Dai Balance: {daiBalances ? daiBalances.mainnet : "loading..."}
        </StatTypography>
        <StatTypography>
          Public Identifier:
          xpub6Di1bLRzeR8icvPKfZxir23fE54AhgWn6bxeuDD4yGWtgHK59LDQgojdyNqtjeg134svT126JzrKR9vjn1UWdUFzTHzNMER9QpS8UuQ9L8m
        </StatTypography>
      </StatGrid>

      <StatGrid>
        <a href={`https://etherscan.io/address/${address.staging}`}>Staging</a>
        <StatTypography>
          Eth Balance: {ethBalances ? ethBalances.staging : "loading..."}
        </StatTypography>
        <StatTypography>
          Dai Balance: {daiBalances ? daiBalances.staging : "loading..."}
        </StatTypography>
        <StatTypography>Public Identifier: ???</StatTypography>
      </StatGrid>
      <StatGrid>
        <a href={`https://etherscan.io/address/${address.rinkeby}`}>Rinkeby</a>
        <StatTypography>
          Eth Balance: {ethBalances ? ethBalances.rinkeby : "loading..."}
        </StatTypography>
        <StatTypography>
          Dai Balance: {daiBalances ? daiBalances.rinkeby : "loading..."}
        </StatTypography>
        <StatTypography>
          Public Identifier:
          xpub6EUSTe4tBM9vQFvYf3jNHfHAVasAVndhVdn1jFv5vv3dBwjxtiDbQoPZiCUYhNH3EFeiYVeKSckn4YqVqG9NhBe9K8XFF3xa1m9Z3h7kyBW
        </StatTypography>
      </StatGrid>
    </TopGrid>
  );
}

export default DebugNode;
