FROM haproxy:2.1.3-alpine
WORKDIR /root
ENV HOME /root
RUN apk add --update --no-cache bash certbot curl iputils openssl && \
    openssl dhparam -out /etc/ssl/dhparam.pem 2048
RUN curl https://raw.githubusercontent.com/vishnubob/wait-for-it/ed77b63706ea721766a62ff22d3a251d8b4a6a30/wait-for-it.sh > /bin/wait-for && chmod +x /bin/wait-for
COPY proxy/daicard/ /root/
ENTRYPOINT ["bash", "/root/entry.sh"]
