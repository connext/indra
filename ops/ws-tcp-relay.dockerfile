FROM alpine:3.10
WORKDIR /root
ENV HOME /root
ARG VERSION=6e254ec204b3b45df7c1492bdd3bff30edcfd0e8

# install build tools, download source code, and build
RUN apk add --no-cache --virtual build-tools \
    gcc git go linux-headers make musl-dev openssl

RUN git clone --progress https://github.com/isobit/ws-tcp-relay.git /ws-tcp-relay \
 && cd /ws-tcp-relay \
 && git checkout $VERSION

RUN  go get -v golang.org/x/net/websocket

RUN cd /ws-tcp-relay && make \
 && cp /ws-tcp-relay/ws-tcp-relay /usr/local/bin/ \
 && cd $HOME \
 && rm -rf /ws-tcp-relay \
 && apk del build-tools \
 && apk add --no-cache ca-certificates

EXPOSE 4223

ENTRYPOINT ["ws-tcp-relay"]
