#!/bin/bash

set -e

# define a clean error handler
function err { >&2 echo "Error: $1"; exit 1; }

# Sanity check: were we given a hostname?
[[ -n "$1" && -z "$2" ]] || err "Provide droplet's hostname as the first & only arg"

hostname="$1"
me="`whoami`"

# Prepare to set or use our user's password
echo "Set a new sudo password for REMOTE machine's users.. and again to confirm (no echo)"
echo -n "> "
read -s password
echo
echo -n "> "
read -s confirm
echo

if [[ "$password" != "$confirm" ]]
then
  echo "Passwords did not match, aborting"
  exit
fi

# If we can login as root then setup a sudo user & turn off root login
if ssh -q root@$hostname exit 2> /dev/null
then
  ssh root@$hostname "bash -s" <<-EOF
	set -e

	function createuser {
		adduser --gecos "" \$1 <<-EOIF
		\$2
		\$2
		EOIF
		usermod -aG sudo \$1
		mkdir -v /home/\$1/.ssh
		cat /root/.ssh/authorized_keys | grep \$1 >> /home/\$1/.ssh/authorized_keys
		chown -vR \$1:\$1 /home/\$1
	}

	createuser $me $password

	# Turn off password authentication
	sed -i '/PasswordAuthentication/ c\
	PasswordAuthentication no
	' /etc/ssh/sshd_config

	# Turn off root login
	sed -i '/PermitRootLogin/ c\
	PermitRootLogin no
	' /etc/ssh/sshd_config

	EOF
else
	echo "root login disabled, skipping user setup"
fi

aliases="$HOME/.bash_aliases"
if [[ -e "$aliases" ]]
then scp $aliases $hostname:~
else echo "couldn't copy $aliases"
fi

ssh $hostname "sudo -S bash -s" <<EOF
$password

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

usermod -aG docker $me
systemctl enable docker

privateip=\`ifconfig eth1 | grep 'inet ' | awk '{print \$2;exit}' | sed 's/addr://'\`
docker swarm init "--advertise-addr=\$privateip"

# Double-check upgrades
DEBIAN_FRONTEND=noninteractive apt-get -y -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold" dist-upgrade
apt-get autoremove -y

reboot
EOF
