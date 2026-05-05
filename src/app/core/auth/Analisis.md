
1. Access Token es efimero en memoria (signals)
2. Tenemos un resfresh token de larga duracion 7 dias, como cookie con HttpOnly/Secure/SameSite=Strict

Calificacion       |     Aspecto                                                 |
Excelente          | Almacenamiento de tokens (sin localstorage/sessionstorage) 
Excelente          | Encapsulacion del estado (signals privados + readonly publico)
Excelente          | Mitigacion de la "Ventana B" del refresh (gate + shareReplay)


OWASP 
A01 Broken Access Control | 
A02 Cryptographic Failure |
A03 Injection             |
A04 Inscure Design        |
