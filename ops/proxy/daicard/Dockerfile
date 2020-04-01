FROM haproxy:2.1.3-alpine
WORKDIR /root
ENV HOME /root
RUN apk add --update --no-cache bash certbot curl iputils openssl && \
    openssl dhparam -out /etc/ssl/dhparam.pem 2048
COPY wait-for.sh /root/wait-for.sh
COPY proxy/daicard/ /root/
ENTRYPOINT ["bash", "/root/entry.sh"]
