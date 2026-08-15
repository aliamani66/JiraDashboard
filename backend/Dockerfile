ARG REGISTRY=docker.arvancloud.ir
FROM ${REGISTRY}/node:20-alpine

WORKDIR /app

# کپی تمامی فایل‌ها شامل پکیج‌های آفلاین (node_modules)
COPY . .

# اجرای شرطی npm install فقط در صورتی که node_modules از قبل در ریپازیتوری نباشد
RUN if [ ! -d "node_modules/express" ]; then npm install --omit=dev --legacy-peer-deps || true; fi

EXPOSE 3001
ENV PORT=3001

CMD ["sh", "-c", "if [ ! -f database.sqlite ]; then node src/seed.js; fi && node src/app.js"]
