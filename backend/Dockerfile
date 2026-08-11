ARG REGISTRY=docker.io
FROM ${REGISTRY}/node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm config set registry https://registry.npmmirror.com \
    && npm config set fetch-retries 5 \
    && npm config set fetch-retry-mintimeout 20000 \
    && npm install --production --no-audit --no-fund

COPY . .

EXPOSE 3001

ENV PORT=3001

CMD ["sh", "-c", "if [ ! -f database.sqlite ]; then node src/seed.js; fi && node src/app.js"]
