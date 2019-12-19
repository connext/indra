FROM alpine:3.10
RUN apk add bash openssh
COPY entrypoint.sh /entrypoint.sh
ENTRYPOINT ["bash", "/entrypoint.sh"]
