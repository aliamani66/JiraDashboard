ARG REGISTRY=docker.arvancloud.ir
FROM ${REGISTRY}/node:20-alpine

WORKDIR /app

# کپی کامل کدهای بک‌اند و پکیج‌های آفلاین
COPY backend/ .

# کپی فرانت‌اند بیلد شده جهت ارائه مستقیم توسط سرور Node.js (بدون نیاز به Nginx)
COPY frontend/dist/ ./public/

EXPOSE 3001
ENV PORT=3001

CMD ["sh", "-c", "if [ ! -f database.sqlite ]; then node src/seed.js; fi && node src/app.js"]
