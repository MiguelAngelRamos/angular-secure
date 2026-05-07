# PATRÓN MILTI-STAGE (varias etapas)
# Etapa Build:
# Node, pnpm y todo el código fuente para compilar la aplicación
#! No pineada (móvil)
FROM node:22-alpine AS builder

# -- Seguridad principio de menor privilegio
# No ejecutamos comandos como root. Si una dependencia maliciosa o un script
# post-install se ejecuta durante el build, quedaria limitado al usuario "node" que no tiene permisos de administrador.
RUN corepack enable

USER node

# Establecemos el directorio de trabajo dentro del contenedor
WORKDIR /home/node/app

COPY --chown=node:node package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile
## Ahora copiar el resto código fuente (lo que .dockerignore no excluye)
## . (destino: WORKDIR actual /home/node/app)
## . (origen: la raiz del contexto del build (tu carpeta del proyecto))
COPY --chown=node:node . .

RUN pnpm run build --configuration=production

## Serve (servir archivos estáticos con un servidor web ligero)
#! No pineada (móvil)
FROM nginx:1.27-alpine AS runner

RUN rm -f /etc/nginx/conf.d/default.conf
COPY --from=builder /home/node/app/dist/angularsecure /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

RUN chmod -R 555 /usr/share/nginx/html \
  && chown -R nginx:nginx /var/cache/nginx \
  && chown -R nginx:nginx /var/log/nginx \
  && chown nginx:nginx /etc/nginx/conf.d/app.conf

## Seguridad ejecutar usuario no root para servir la aplicación
USER nginx
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:8080/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
