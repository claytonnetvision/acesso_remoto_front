FROM ubuntu:22.04

ARG FRP_VERSION=0.61.1

RUN apt-get update && apt-get install -y wget ca-certificates && \
    wget -q https://github.com/fatedier/frp/releases/download/v${FRP_VERSION}/frp_${FRP_VERSION}_linux_amd64.tar.gz && \
    tar -xzf frp_${FRP_VERSION}_linux_amd64.tar.gz && \
    cp frp_${FRP_VERSION}_linux_amd64/frps /usr/local/bin/frps && \
    chmod +x /usr/local/bin/frps && \
    rm -rf frp_${FRP_VERSION}_linux_amd64* && \
    apt-get clean

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 7000

ENTRYPOINT ["/entrypoint.sh"]
