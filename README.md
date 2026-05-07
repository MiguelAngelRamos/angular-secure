## Construir imagen de Angular

```sh
docker build -t angular-secure:1.0.0 .
```

## Levantar el contenedor
```sh
 docker run -d --name angular-secure -p 8080:8080 angular-secure:1.0.0
```
