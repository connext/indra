import React, {useEffect, useState} from "react";
import { Grid, Typography, styled, Button } from "@material-ui/core";

const TopGrid = styled(Grid)({
  display: "flex",
  flexWrap: "wrap",
  flexDirection: "row",
  width: "100%",
  height: "100%",
  justifyContent: "center",
  alignItems: "center",
});

const StatTypography = styled(Typography)({
  textAlign: "center",
  width: "90%",
  fontSize: "24px",
  color: "#002868",
  textDecoration: "none",
});

function StatsExport({ classes, messaging }) {

  const [allTransfers, setAllTransfers] = useState(null);


  function convertArrayOfObjectsToCSV(args) {
    var result, ctr, keys, columnDelimiter, lineDelimiter, data;

    data = args.data || null;
    if (data == null || !data.length) {
      return null;
    }

    columnDelimiter = args.columnDelimiter || ",";
    lineDelimiter = args.lineDelimiter || "\n";

    keys = Object.keys(data[0]);

    result = "";
    result += keys.join(columnDelimiter);
    result += lineDelimiter;

    data.forEach(function(item) {
      ctr = 0;
      keys.forEach(function(key) {
        if (ctr > 0) result += columnDelimiter;

        result += item[key];
        ctr++;
      });
      result += lineDelimiter;
    });

    return result;
  }

  function downloadCSV(args) {
    var data, filename, link;
    var csv = convertArrayOfObjectsToCSV({
      data: args.data,
    });
    if (csv == null) return;

    filename = args.filename || "export.csv";

    if (!csv.match(/^data:text\/csv/i)) {
      csv = "data:text/csv;charset=utf-8," + csv;
    }
    data = encodeURI(csv);

    link = document.createElement("a");
    link.setAttribute("href", data);
    link.setAttribute("download", filename);
    link.click();
  }

  async function getTransferDataAndDownload(){
      if (!messaging) {
        return;
      }
      const res = await messaging.getAllLinkedTransfers();
      if(res){
        downloadCSV({ data: res, filename: "transfer-data.csv" })
      }
  }

  async function getChannelDataAndDownload(){
    if (!messaging) {
      return;
    }
    const res = await messaging.getAllChannelStates();
    if(res){
      downloadCSV({ data: res, filename: "transfer-data.csv" })
    }
}

  return (
    <TopGrid container>
      <Button onClick={getTransferDataAndDownload}>Download CSV of Transfers</Button>
      <Button onClick={getChannelDataAndDownload}>Download CSV of Channels</Button>
    </TopGrid>
  );
}

export default StatsExport;
