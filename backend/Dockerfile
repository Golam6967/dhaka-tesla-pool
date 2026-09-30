FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# node:20-alpine already ships an unprivileged 'node' user — running as root
# inside the container is unnecessary privilege the app doesn't need.
RUN chown -R node:node /app
USER node

EXPOSE 4000

CMD ["npm", "start"]
