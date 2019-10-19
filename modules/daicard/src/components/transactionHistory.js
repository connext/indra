import Grid from "@material-ui/core/Grid";
import { makeStyles } from '@material-ui/core/styles';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import React, { useEffect } from "react";

export const TransactionHistory = ({ channel }) => {
  useEffect(() => {
    if (!channel) {
      return
    }
    async function init() {
      const txHistory = await channel.getTransferHistory();
    }
    init();
  }, [channel])
  return (
    <Grid
      container
      spacing={2}
      direction="column"
      style={{
        paddingLeft: 12,
        paddingRight: 12,
        paddingTop: "10%",
        paddingBottom: "10%",
        textAlign: "center",
        justifyContent: "center",
      }}
    >
      <Grid item xs={12}>
        <Table size="small" aria-label="a dense table">
          <TableHead>
            <TableRow>
              <TableCell>Type</TableCell>
              <TableCell align="right">Amount</TableCell>
              <TableCell align="right">Recipient</TableCell>
              <TableCell align="right">Asset</TableCell>
            </TableRow>
          </TableHead>
        </Table>
      </Grid>
    </Grid>
  );
};
