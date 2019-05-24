FROM node:9.3.0

WORKDIR /home/node/app/common/

ADD common/package.json .
ADD common/yarn.lock .

RUN yarn install

ADD common .

RUN yarn build

WORKDIR /home/node/app/hub/

ADD hub/package.json .
ADD hub/yarn.lock .

RUN yarn

ADD hub .

RUN yarn run build

CMD ["node", "/home/node/app/hub/dist/spankchain/main.js"]
