FROM zenika/alpine-chrome:with-puppeteer as base
ENV DISTRO=alpine

USER root

RUN apk update
RUN apk upgrade
RUN npm install -g typescript
RUN npm install -g pnpm

WORKDIR /usr/app

ADD https://api.github.com/repos/david-ma/Thalia/git/refs/heads/master Thalia_version.json
RUN git clone --depth=1 https://github.com/david-ma/Thalia.git
WORKDIR /usr/app/Thalia
RUN pnpm install --ignore-scripts --prod

USER chrome

CMD ["/usr/app/Thalia/start.sh"]


# To build for multiple platforms:
# docker buildx build --push --platform linux/arm64/v8,linux/amd64 --progress=plain --tag frostickle/thalia:1.0.3 .
