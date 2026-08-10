ARG REGISTRY=docker.io
FROM ${REGISTRY}/nginx:alpine

# نصب openssl برای ساخت سرتیفیکیت
RUN apk add --no-cache openssl

# کپی فایل‌های کانفیگ
COPY default-ssl.conf /etc/nginx/conf.d/default.conf
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 80 443

ENTRYPOINT ["/entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
