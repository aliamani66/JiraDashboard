ARG REGISTRY=docker.arvancloud.ir
FROM ${REGISTRY}/node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev --legacy-peer-deps || true
COPY . .

EXPOSE 3001

ENV PORT=3001

CMD ["sh", "-c", "if [ ! -f database.sqlite ]; then node src/seed.js; fi && node src/app.js"]
