FROM haproxy:2.1.3-alpine
WORKDIR /root
ENV HOME /root
RUN apk add --update --no-cache bash ca-certificates certbot curl iputils openssl
COPY wait-for.sh /root/wait-for.sh
COPY proxy/indra/ /root/
ENTRYPOINT ["bash", "/root/entry.sh"]
