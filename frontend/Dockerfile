FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# NEXT_PUBLIC_* variables are inlined into the client bundle at build time by
# webpack — setting them via `docker-compose`'s `environment:` at container
# start has no effect on an already-built app. This must be passed as a build
# ARG (see docker-compose.yml's `build.args`) so the correct API URL is baked
# in before `next build` runs.
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN npm run build

USER node
EXPOSE 3000

CMD ["npm", "start"]
