FROM node:12.13.0-alpine3.10
WORKDIR /root
ENV HOME /root
RUN apk add --update --no-cache bash curl g++ gcc git jq make python python3
RUN npm config set unsafe-perm true
RUN npm install -g npm@6.14.7
RUN npm install -g lerna@3.22.1
RUN python3 -m pip install --upgrade --no-cache-dir pip==20.1.0 virtualenv
RUN curl https://raw.githubusercontent.com/vishnubob/wait-for-it/ed77b63706ea721766a62ff22d3a251d8b4a6a30/wait-for-it.sh > /bin/wait-for && chmod +x /bin/wait-for
COPY entry.sh /entry.sh
ENV PATH="./node_modules/.bin:${PATH}"
ENTRYPOINT ["bash", "/entry.sh"]
