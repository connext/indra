import React from "react";
import { styled } from '@material-ui/core/styles';
import Grid from '@material-ui/core/Grid';
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";
import ExpansionPanel from "@material-ui/core/ExpansionPanel";
import ExpansionPanelDetails from "@material-ui/core/ExpansionPanelDetails";
import ExpansionPanelSummary from "@material-ui/core/ExpansionPanelSummary";
import Typography from "@material-ui/core/Typography";
import ExpandMoreIcon from "@material-ui/icons/ExpandMore";

const StyledExpansionPanel = styled(ExpansionPanel)({
  width: "100%",
});

export const IncorrectProxyFactoryAddress = ({ tableData }) => (
  <Grid item xs={12}>
    <StyledExpansionPanel>
      <ExpansionPanelSummary expandIcon={<ExpandMoreIcon />} disabled={!Array.isArray(tableData) || tableData.length === 0}>
        <Typography>{tableData.length} Affected Channels</Typography>
      </ExpansionPanelSummary>
      <ExpansionPanelDetails>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Multisig Address</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {tableData.map((row, index) => (
              <TableRow key={index}>
                <TableCell component="th" scope="row">
                  {row.multisigAddress}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ExpansionPanelDetails>
    </StyledExpansionPanel>
  </Grid>
);
