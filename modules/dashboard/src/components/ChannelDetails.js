import React, { Component } from "react";
import PropTypes from 'prop-types';
import { withStyles } from '@material-ui/core/styles';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import Paper from '@material-ui/core/Paper';
import axios from "axios";

const styles = {
  root: {
    width: '100%',
    overflowX: 'auto',
  },
  table: {
    minWidth: 700,
  },
};

class ChannelDetails extends Component {
  constructor(props) {
    super(props);
    this.state = {
      classes: props.classes,
      data: []
    }
  }

  async componentDidMount() {
    let id = 0;
    const createData = async () => {
      const url = `${this.props.urls.api}/test`
      const res = (await axios.get(test)).data || null
      let data = res[id]
      id += 1;
      return { id, data };
    }
    let data = this.state.data
    data.push(await createData())
    data.push(await createData())
    this.setState({
      data
    });
  }

  render () {
    return (
      <Paper className={this.state.classes.root}>
        <Table className={this.state.classes.table}>
          <TableHead>
            <TableRow>
              <TableCell>Text</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {this.state.data.map(n => (
              <TableRow key={n.id}>
                <TableCell component="th" scope="row">
                  {n.data}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    );
  };
}

ChannelDetails.propTypes = {
  classes: PropTypes.object.isRequired,
};

export default withStyles(styles)(ChannelDetails);
