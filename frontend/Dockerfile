FROM node:24-alpine AS build
WORKDIR /app

ARG VITE_API_BASE_PATH=/api
ARG VITE_API_PROXY_TARGET=http://backend:8080

ENV VITE_API_BASE_PATH=${VITE_API_BASE_PATH}
ENV VITE_API_PROXY_TARGET=${VITE_API_PROXY_TARGET}

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.27-alpine
WORKDIR /usr/share/nginx/html
USER root
RUN apk add --no-cache curl \
    && mkdir -p /var/log/nginx /var/cache/nginx \
    && chown -R nginx:nginx /usr/share/nginx/html /var/log/nginx /var/cache/nginx /etc/nginx/conf.d
COPY --from=build --chown=nginx:nginx /app/dist .
COPY --chown=nginx:nginx nginx.conf /etc/nginx/conf.d/default.conf
USER nginx

EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --start-period=8s --retries=10 \
  CMD curl -fsS http://127.0.0.1:8080/healthz > /dev/null

CMD ["nginx", "-g", "daemon off;"]
