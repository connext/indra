import React from "react";
import Button from "@material-ui/core/Button"
import ListItem from "@material-ui/core/ListItem";
import ListItemIcon from "@material-ui/core/ListItemIcon";
import ListItemText from "@material-ui/core/ListItemText";
//import ListSubheader from "@material-ui/core/ListSubheader";
import Home from "@material-ui/icons/Home";
//import ShoppingCartIcon from "@material-ui/icons/ShoppingCart";
import PeopleIcon from "@material-ui/icons/People";
import Archive from "@material-ui/icons/Archive";
import Unarchive from "@material-ui/icons/Unarchive";
import AttachMoney from "@material-ui/icons/AttachMoney";
import LocalGasStation from "@material-ui/icons/LocalGasStation";
import { Link } from 'react-router-dom'


//import BarChartIcon from "@material-ui/icons/BarChart";
//import LayersIcon from "@material-ui/icons/Layers";
//import AssignmentIcon from "@material-ui/icons/Assignment";

export const mainListItems = (
  <div>
    <ListItem button component={Link} to="/">
      <ListItemIcon>
        <Home />
      </ListItemIcon>
      <ListItemText primary="Home" />
    </ListItem>
    <ListItem button  component={Link} to="/deposits">
      <ListItemIcon>
        <Archive />
      </ListItemIcon>
      <ListItemText primary="Deposits" />
    </ListItem>
    <ListItem button  component={Link} to="/payments">
      <ListItemIcon>
        <AttachMoney />
      </ListItemIcon>
      <ListItemText primary="Payments" />
    </ListItem>
    <ListItem button component={Link} to="/withdrawals">
      <ListItemIcon>
        <Unarchive />
      </ListItemIcon>
      <ListItemText primary="Withdrawals" />
    </ListItem>
    <ListItem button  component={Link} to="/gas">
      <ListItemIcon>
        <LocalGasStation />
      </ListItemIcon>
      <ListItemText primary="Gas" />
    </ListItem>
    <ListItem button  component={Link} to="/users">
      <ListItemIcon>
        <PeopleIcon />
      </ListItemIcon>
      <ListItemText primary="Users" />
    </ListItem>
  </div>
);
