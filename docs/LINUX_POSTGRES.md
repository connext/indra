# Installing Postgres Locally on Linux

*Tested only with Ubuntu 18.04. Some steps may change for other distros*

### Installing PostgreSQL
Make sure to install version 9.6 - *it isn't a part of apt-get by default*.

If you have an existing instance of PostgreSQL 10 installed, remove by running:
```
sudo apt-get --purge remove postgresql
dpkg -l | grep postgres (to look for postgresfiles in the system)
sudo rm -rf postgresql ... (remove all the files that appeared in the list after running the previous command)
```
Then, set up the source repositories and install.
```
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt/ `lsb_release -cs`-pgdg main" >> /etc/apt/sources.list.d/pgdg.list'  

wget -q https://www.postgresql.org/media/keys/ACCC4CF8.asc -O - | sudo apt-key add - 

sudo apt-get update  
sudo apt-get upgrade 
sudo apt-get install postgresql-9.6 
```

### Setting Up Your User
By default, installing using the above method will not properly set up your user account and password. 

If you try calling the `hub-reset` script, you'll likely see the following error:
```
[INFO] Using dev settings: { driver: 'pg', database: 'sc-hub' }
[INFO] require: db-migrate-pg
[INFO] connecting
[ERROR] error: password authentication failed for user "<YOUR_LINUX_USER_NAME>"
```
Or an error that says your user does not exist.

To create your user account, first log into your postgres server using the postgres superuser role.
```
sudo -i -u postgres
````
It should prompt you for your password. Then it'll take you to your local linux postgres user account. Here, type `psql` to enter the postgres server prompt.

Then, create your user (if it doesn't exist) and set a password:
```
postgres=# CREATE USER <YOUR_LINUX_USER_NAME>;
postgres=# ALTER USER <YOUR_LINUX_USER_NAME> WITH PASSWORD <ANY_SIMPLE_PASSWORD>;
```
Then close the terminal window.

### Setting Up Your Password File
In order to have the `hub-reset` and `hub-run` scripts correctly access your user account, you will have to set up a `.pgpass` file in your home directory.

First, `cd ~`
Then,
```
touch ~/.pgpass && nano ~./pgpass
```

In the file, add the following lines:
```
localhost:*:*:<YOUR_LINUX_USER_NAME>:<ANY_SIMPLE_PASSWORD>
127.0.0.1:*:*:<YOUR_LINUX_USER_NAME>:<ANY_SIMPLE_PASSWORD>
```
Then `ctrl + O` + `enter` to save and `ctrl + X` to exit.

Lastly, in the same directory, type `chmod 600 ~/.pgpass`. This will set the permissions of the file to an administrative level.

You should now be okay to run the hub setup scripts as per the normal indra setup instructions.

*NOTE: This method is only meant for your local installation. You are keeping your password in cleartext so be sure to not use your real passwords*
