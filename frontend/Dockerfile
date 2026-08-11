# Build Stage
ARG REGISTRY=docker.io
FROM ${REGISTRY}/node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
# تنظیم میرور و غیرفعال کردن audit/fund جهت جلوگیری از قفل شدن داکر
RUN npm config set registry https://registry.npmmirror.com \
    && npm config set fetch-retries 5 \
    && npm config set fetch-retry-mintimeout 20000 \
    && npm install --no-audit --no-fund

COPY . .
ARG VITE_API_BASE=/api
ENV VITE_API_BASE=$VITE_API_BASE

RUN npm run build

# Production Stage
FROM ${REGISTRY}/nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
