# mdgarden in a container — for CI / cloud builds with no host Node setup.
#
#   docker build -t mdgarden .
#   docker run --rm -v "$PWD:/site" mdgarden build
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
LABEL org.opencontainers.image.title="mdgarden" \
      org.opencontainers.image.description="Turn a folder of Markdown notes into a fast static website" \
      org.opencontainers.image.source="https://github.com/THANSHEER/mdsite" \
      org.opencontainers.image.licenses="GPL-3.0-or-later"
WORKDIR /site
COPY --from=build /app/mdgarden-*.tgz /tmp/
RUN npm install -g /tmp/mdgarden-*.tgz && rm /tmp/mdgarden-*.tgz
ENTRYPOINT ["mdgarden"]
CMD ["build"]
