FROM node:10-alpine
WORKDIR /root
ENV HOME /root
RUN apk add --update --no-cache bash curl g++ gcc git jq make python
RUN npm install -g mocha
ENTRYPOINT ["mocha"]
CMD [\
  "--require=ts-node/register/type-check", \
  "--require=src/register/common.ts", \
  "--require=src/register/testing.ts", \
  "src/**/*.test.ts", "--exit" \
]
