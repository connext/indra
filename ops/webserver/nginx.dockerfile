FROM alpine:3.10

RUN apk add --update --no-cache nginx && \
    ln -fs /dev/stdout /var/log/nginx/access.log && \
    ln -fs /dev/stdout /var/log/nginx/error.log

COPY ops/webserver/nginx.conf /etc/nginx/nginx.conf
COPY modules/daicard/build /var/www/html

ENTRYPOINT ["nginx"]
