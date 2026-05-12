# PATRÓN MULTI-STAGE (varias etapas)
# Etapa Build:
# Node, pnpm y todo el código fuente para compilar la aplicación
FROM node:22.22.2-alpine3.22@sha256:b77017c37f430e4466ff497058948a2f16e8b59779600d53711eeb7b999b0f4e AS builder

# Activar pnpm con versión específica (evita descarga dinámica)
RUN corepack enable \
 && corepack prepare pnpm@9.15.0 --activate

USER node
# Establecemos el directorio de trabajo dentro del contenedor
WORKDIR /home/node/app

COPY --chown=node:node package.json pnpm-lock.yaml ./

RUN pnpm config set ignore-scripts true \
 && pnpm install --frozen-lockfile --prefer-offline

## Ahora copiar el resto código fuente (lo que .dockerignore no excluye)
## . (destino: WORKDIR actual /home/node/app)
## . (origen: la raiz del contexto del build (tu carpeta del proyecto))
COPY --chown=node:node . .

RUN pnpm run build --configuration=production

## Serve (servir archivos estáticos con un servidor web ligero)
FROM nginx:1.27-alpine@sha256:0272e4604ed93c1792f03695a033a6e8546840f86e0de20a884bb17d2c924883 AS runner

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

## Seguridad ejecutar usuario no root para servir la aplicación
USER nginx
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q --spider http://localhost:8080/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
