FROM alpine:3.10

RUN apk add --update --no-cache bash curl iputils nginx && \
    ln -fs /dev/stdout /var/log/nginx/access.log && \
    ln -fs /dev/stdout /var/log/nginx/error.log

COPY ops/webserver/nginx.conf /etc/nginx/nginx.conf
COPY modules/daicard/build /var/www/html/daicard
COPY modules/dashboard/build /var/www/html/dashboard

ENTRYPOINT ["nginx"]
