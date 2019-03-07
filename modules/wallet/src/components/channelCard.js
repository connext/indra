import React, { Component } from "react";
import Card from "@material-ui/core/Card";
import Typography from "@material-ui/core/Typography";
//import HelpIcon from "@material-ui/icons/Help";
//import IconButton from "@material-ui/core/IconButton";
//import Popover from "@material-ui/core/Popover";
import { CopyToClipboard } from "react-copy-to-clipboard";
import Tooltip from "@material-ui/core/Tooltip";

class ChannelCard extends Component {
  render() {
    const cardStyle = {
      card: {
        display: "flex",
        flexWrap: "wrap",
        flexBasis: "100%",
        flexDirection: "row",
        width: "500px",
        height: "200px",
        justifyContent: "center",
        padding: "1% 4% 4% 4%",
        backgroundColor: "#282B2E",
        color: "white"
      },
      row: {
        width: "100%",
        justifyContent: "center",
        color: "white"
      },
      clipboard: {
        cursor: "pointer"
      },
      input: {
        width: "100%"
      },
      button: {
        width: "100%",
        height: "40px"
      },
      headerText: {
        marginTop: "13px",
        marginLeft: "30px",
        color: "white"
      },
      headerIcon: {},
      popover: {
        padding: "8px 8px 8px 8px"
      }
    };

    return (
      <Card style={cardStyle.card}>
        <Typography variant="h5" style={cardStyle.headerText}>
          Channel Information
        </Typography>

        <Typography variant="subtitle1" style={cardStyle.row}>
          <CopyToClipboard
            style={cardStyle.clipboard}
            text={this.props.address}
          >
            <Tooltip
              disableFocusListener
              disableTouchListener
              title="Click to Copy"
            >
              <span>{this.props.address}</span>
            </Tooltip>
          </CopyToClipboard>
        </Typography>
        <Typography variant="h6" style={cardStyle.row}>
          ETH:{" "}
          {this.props.channelState ? (
            <span>{this.props.channelState.balanceWeiUser} Wei </span>
          ) : (
            <span> 0</span>
          )}{" "}
        </Typography>

        <Typography gutterBottom variant="h6" style={cardStyle.row}>
          TST:{" "}
          {this.props.channelState ? (
            <span>{this.props.channelState.balanceTokenUser} Wei </span>
          ) : (
            <span> 0</span>
          )}{" "}
        </Typography>

        <Typography variant="h6" style={cardStyle.row}>
          Hub ETH:{" "}
          {this.props.channelState ? (
            <span>{this.props.channelState.balanceWeiHub} Wei </span>
          ) : (
            <span> 0</span>
          )}{" "}
        </Typography>

        <Typography variant="h6" style={cardStyle.row}>
          Hub TST:{" "}
          {this.props.channelState ? (
            <span>{this.props.channelState.balanceTokenHub} Wei </span>
          ) : (
            <span> 0</span>
          )}{" "}
        </Typography>
      </Card>
    );
  }
}

export default ChannelCard;
