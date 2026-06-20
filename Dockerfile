# mdsite in a container — for CI / cloud builds with no host Node setup.
#
#   docker build -t mdsite .
#   docker run --rm -v "$PWD:/site" mdsite build
#
# Builds from source (so the image doesn't depend on an npm release), then
# installs the packed tarball into a slim runtime stage.

# --- build stage -----------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app
# Install deps without lifecycle scripts (the `prepare` build needs src/, which
# isn't copied yet). Then bring in the source and build + pack.
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build && npm pack --ignore-scripts

# --- runtime stage ---------------------------------------------------------
FROM node:22-alpine
LABEL org.opencontainers.image.title="mdsite" \
      org.opencontainers.image.description="Turn a folder of Markdown notes into a fast static website" \
      org.opencontainers.image.source="https://github.com/THANSHEER/mdsite" \
      org.opencontainers.image.licenses="GPL-3.0-or-later"
WORKDIR /site
COPY --from=build /app/mdsite-*.tgz /tmp/
RUN npm install -g /tmp/mdsite-*.tgz && rm /tmp/mdsite-*.tgz
ENTRYPOINT ["mdsite"]
CMD ["build"]
