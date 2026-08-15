ARG REGISTRY=docker.arvancloud.ir
FROM ${REGISTRY}/node:20-alpine

WORKDIR /app

# کپی کامل فایل‌های پروژه
COPY . .

# در صورتی که پکیج‌ها موجود باشند یا سرور آفلاین باشد، فرآیند Build متوقف نمی‌شود
RUN if [ ! -d "node_modules/express" ]; then npm install --omit=dev --legacy-peer-deps --prefer-offline --no-audit 2>/dev/null || true; fi

EXPOSE 3001
ENV PORT=3001

CMD ["sh", "-c", "if [ ! -f database.sqlite ]; then node src/seed.js; fi && node src/app.js"]
