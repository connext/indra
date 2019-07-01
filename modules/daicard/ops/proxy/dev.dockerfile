FROM alpine:3.8

RUN apk add --update --no-cache bash certbot curl iputils nginx openssl && \
    openssl dhparam -out /etc/ssl/dhparam.pem 2048 && \
    ln -fs /dev/stdout /var/log/nginx/access.log && \
    ln -fs /dev/stdout /var/log/nginx/error.log

COPY ops/proxy/dev.conf /etc/nginx/nginx.conf
COPY ops/proxy/entry.sh /root/entry.sh
COPY ops/wait_for.sh /root/wait_for.sh

ENTRYPOINT ["bash", "/root/entry.sh"]
