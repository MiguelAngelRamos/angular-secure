# Patrón Multi-Stage
#  Patrón: multi-stage build (3 etapas).
#    1) deps     → instala TODAS las dependencias (incluye dev) con build tools
#                  necesarios para compilar argon2 (dependencia nativa).
#    2) builder  → compila el código TypeScript → JavaScript en /dist.
#    3) runner   → imagen FINAL mínima, con solo dependencias de producción y
#                  ejecutándose como usuario sin privilegios.
#! No pineada (móvil)
FROM node:21-alpine as builder

#! No pineada (latest)
RUN corepack enable \
  && corepack prepare pnpm@latest --activate

USER node

WORKDIR /home/node/app

COPY --chown=node:node package.json pnpm-lock.yaml ./

RUN pnpm config set ignore-scripts true \
 && pnpm install --frozen-lockfile --prefer-offline

COPY --chown=node:node . .

RUN pnpm run build --configuration=production

#! No pineada (móvil)
FROM nginx:1.27-alpine as runner
LABEL org.opencontainers.image.source="https://github.com/MiguelAngelRamos/angular-secure" \
      org.opencontainers.image.title="clinic-frontend" \
      org.opencontainers.image.description="Angular 21 SPA"


RUN rm -f /etc/nginx/conf.d/default.conf
COPY --from=builder /home/node/app/dist/angularsecure/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/app.conf

RUN chmod -R 555 /usr/share/nginx/html \
  && chown -R nginx:nginx /var/cache/nginx \
  && chown -R nginx:nginx /var/log/nginx \
  && chown nginx:nginx /etc/nginx/conf.d/app.conf \
  && touch /var/run/nginx.pid \
  && chown nginx:nginx /var/run/nginx.pid

USER nginx
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q --spider http://localhost:8080/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
