# Stage 1: build the Hugo site
FROM docker.io/hugomods/hugo:reg-0.155.1 AS build

COPY . /src
WORKDIR /src
RUN hugo --minify

# Stage 2: serve with Caddy
FROM docker.io/library/caddy:2-alpine

COPY --from=build /src/public /srv
COPY Caddyfile /etc/caddy/Caddyfile

EXPOSE 80
