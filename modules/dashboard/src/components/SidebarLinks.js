import React from "react";
import ListItem from "@material-ui/core/ListItem";
import ListItemIcon from "@material-ui/core/ListItemIcon";
import ListItemText from "@material-ui/core/ListItemText";
import Home from "@material-ui/icons/Home";
import PeopleIcon from "@material-ui/icons/People";
import Archive from "@material-ui/icons/Archive";
import CompareArrows from "@material-ui/icons/CompareArrows";
import Unarchive from "@material-ui/icons/Unarchive";
import AttachMoney from "@material-ui/icons/AttachMoney";
import LocalGasStation from "@material-ui/icons/LocalGasStation";
import { Link } from 'react-router-dom'
import List from "@material-ui/core/List";

export const SidebarLinks = (props) => (
  <List>
    <div>
      <ListItem button component={Link} to={`${props.urls.prefix}/`}>
        <ListItemIcon>
          <Home />
        </ListItemIcon>
        <ListItemText primary="Home" />
      </ListItem>
      <ListItem button  component={Link} to={`${props.urls.prefix}/deposits`}>
        <ListItemIcon>
          <Archive />
        </ListItemIcon>
        <ListItemText primary="Deposits" />
      </ListItem>
      <ListItem button  component={Link} to={`${props.urls.prefix}/payments`}>
        <ListItemIcon>
          <AttachMoney />
        </ListItemIcon>
        <ListItemText primary="Payments" />
      </ListItem>
      <ListItem button component={Link} to={`${props.urls.prefix}/withdrawals`}>
        <ListItemIcon>
          <Unarchive />
        </ListItemIcon>
        <ListItemText primary="Withdrawals" />
      </ListItem>
      <ListItem button  component={Link} to={`${props.urls.prefix}/gas`}>
        <ListItemIcon>
          <LocalGasStation />
        </ListItemIcon>
        <ListItemText primary="Gas" />
      </ListItem>
      <ListItem button  component={Link} to={`${props.urls.prefix}/collateral`}>
        <ListItemIcon>
          <CompareArrows />
        </ListItemIcon>
        <ListItemText primary="Collateral" />
      </ListItem>
      <ListItem button  component={Link} to={`${props.urls.prefix}/users`}>
        <ListItemIcon>
          <PeopleIcon />
        </ListItemIcon>
        <ListItemText primary="Users" />
      </ListItem>
    </div>
  </List>
)
