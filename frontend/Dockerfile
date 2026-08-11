ARG REGISTRY=docker.arvancloud.ir
FROM ${REGISTRY}/nginx:alpine

# حذف کانفیگ پیش‌فرض و کپی کانفیگ اختصاصی
RUN rm -rf /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

# کپی فایل‌های فرانت‌اند و تنظیم دسترسی کامل خواندن (رفع خطای 403)
COPY dist /usr/share/nginx/html
RUN chmod -R 755 /usr/share/nginx/html && chown -R nginx:nginx /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
