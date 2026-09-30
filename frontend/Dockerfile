FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# NEXT_PUBLIC_* variables are inlined into the client bundle at build time by
# webpack — setting them via `docker-compose`'s `environment:` at container
# start has no effect on an already-built app. This must be passed as a build
# ARG (see docker-compose.yml's `build.args`) so the correct API URL is baked
# in before `next build` runs.
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN npm run build

# node:20-alpine already ships an unprivileged 'node' user. Files up to this
# point were written as root (npm ci/build need it); hand ownership over
# before switching so 'node' can still write Next.js's runtime cache.
RUN chown -R node:node /app
USER node

EXPOSE 3000

CMD ["npm", "start"]
