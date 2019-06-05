#!/bin/bash
set -e

hostname="$1"
network="${2:-rinkeby}"
user="ubuntu"
key_name="hub_key_$network" # name of docker secret to store private key in
pubkey="$HOME/.ssh/circleci.pub"
prvkey="$HOME/.ssh/connext-aws"

# Sanity checks
if [[ -z "$1" ]]
then echo "Provide the server's hostname or ip address as the first ($1) & only arg ($2)" && exit
fi

if [[ ! -f "$prvkey" ]]
then echo "Couldn't find the ssh private key: $prvkey" && exit
fi

if [[ ! -f "$pubkey" ]]
then echo "Couldn't find the CI public key: $pubkey" && exit
fi

# Prepare to load the hub's private key into the server's secret store
echo "Copy the $key_name secret to your clipboard then paste it below & hit enter (no echo)"
echo -n "> "
read -s key
echo

if ssh -q -i $prvkey ubuntu@$hostname exit 2> /dev/null
then
  echo "Looks like an AWS server, skipping root setup"
  password=""

# If we can login as root then setup a sudo user & turn off root login
elif ssh -q -i $prvkey root@$hostname exit 2> /dev/null
then

  # Prepare to set or use our user's password
  echo "Set a new sudo password for REMOTE machine.. and again to confirm (no echo)"
  echo -n "> "
  read -s password
  echo
  echo -n "> "
  read -s confirm
  echo
  if [[ "$password" != "$confirm" ]]
  then echo "Passwords did not match, aborting" && exit
  fi

  ssh -i $prvkey root@$hostname "bash -s" <<-EOF
		set -e
		function createuser {
			adduser --gecos "" \$1 <<-EOIF
			\$2
			\$2
			EOIF
			usermod -aG sudo \$1
			mkdir -v /home/\$1/.ssh
			cat /root/.ssh/authorized_keys >> /home/\$1/.ssh/authorized_keys
			chown -vR \$1:\$1 /home/\$1
		}

		createuser $user $password

    echo "Turning off password authentication"
		sed -i '/PasswordAuthentication/ c\
		PasswordAuthentication no
		' /etc/ssh/sshd_config

		echo "Turning off root login"
		sed -i '/PermitRootLogin/ c\
		PermitRootLogin no
		' /etc/ssh/sshd_config
		echo "Done with setup as root"
	EOF

else
	echo "root login disabled, skipping user setup"
fi

scp -i $prvkey $pubkey $user@$hostname:~/.ssh/another_authorized_key

ssh -i $prvkey $user@$hostname "sudo -S bash -s" <<EOF
$password
set -e

# add the circle ci key to guest list
cat ~/.ssh/another_authorized_key >> ~/.ssh/authorized_keys
rm -f ~/.ssh/another_authorized_key

# Remove stale apt cache & lock files
sudo rm -rf /var/lib/apt/lists/*

# Upgrade Everything without prompts
# https://askubuntu.com/questions/146921/how-do-i-apt-get-y-dist-upgrade-without-a-grub-config-prompt
apt-get update -y
DEBIAN_FRONTEND=noninteractive apt-get -y -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold" dist-upgrade
apt-get autoremove -y

# Setup firewall
ufw --force reset
ufw allow 22 &&\
ufw --force enable

# Install docker dependencies
apt-get install -y apt-transport-https ca-certificates curl jq make software-properties-common

# Get the docker team's official gpg key
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | apt-key add -

# Add the docker repo & install
add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu \`lsb_release -cs\` stable"
apt-get update -y && apt-get install -y docker-ce

usermod -aG docker $user
systemctl enable docker

privateip=\`ifconfig eth1 | grep 'inet ' | awk '{print \$2;exit}' | sed 's/addr://'\`
docker swarm init "--advertise-addr=\$privateip" 2> /dev/null || true

# Setup docker secret
if [[ -n "\`docker secret ls | grep "$key_name"\`" ]]
then echo "A secret called $key_name already exists, aborting key load"
else
  id="\`echo $key | tr -d ' \n\r' | docker secret create $key_name -\`"
  if [[ "$?" == "0" ]]
  then
    echo "Successfully loaded private key into secret store"
    echo "name=$key_name id=\$id"
    echo
  else echo "Something went wrong creating secret called $key_name"
  fi
fi

# Double-check upgrades
DEBIAN_FRONTEND=noninteractive apt-get -y -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold" dist-upgrade
apt-get autoremove -y

echo
echo "Done configuring server, rebooting now.."
echo

reboot
EOF
