FROM alpine:3.9

RUN mkdir /tmp/build/
# Add context to /tmp/build/
COPY . /tmp/build/
RUN ls /tmp/build
RUN ls -s /tmp/build
RUN du -hs /tmp/build/modules/*
