FROM alpine:3.10
WORKDIR /root
ENV HOME /root
RUN apk add --update --no-cache bash certbot curl iputils haproxy openssl && \
    openssl dhparam -out /etc/ssl/dhparam.pem 2048
COPY wait-for.sh wait-for.sh
COPY proxy/indra/entry.sh entry.sh
COPY proxy/indra/dev.cfg haproxy.cfg
ENTRYPOINT ["bash", "/root/entry.sh"]
