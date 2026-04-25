# Documentación — Surmoda Inventory

Índice de la documentación técnica del sistema **Surmoda Inventory**, elaborada como material de respaldo para la defensa del Proyecto de Grado.

---

## Documentos

| Archivo | Contenido |
|---------|-----------|
| [01-resumen-ejecutivo.md](./01-resumen-ejecutivo.md) | Problema de negocio, solución propuesta, alcance, stakeholders y resultados esperados. Punto de entrada para lectores no técnicos. |
| [02-marco-teorico.md](./02-marco-teorico.md) | Fundamentos técnicos referenciados en el proyecto: Clean Architecture, DDD, JWT, RBAC, Atomic Design, monorepo, soft-delete, pirámide de pruebas, TypeScript strict mode. |
| [04-arquitectura.md](./04-arquitectura.md) | Documento central de arquitectura: capas BE y FE, módulos, inyección de dependencias, flujo de autenticación, auditoría, estrategia de soft-delete y roadmap de features. |
| [05-modelo-datos.md](./05-modelo-datos.md) | Esquema Prisma documentado modelo por modelo, diagrama ER en Mermaid, estrategia de migraciones y entidades planificadas para features 002-009. |
| [06-api-rest.md](./06-api-rest.md) | Referencia completa de la API REST de feature 001: 15 endpoints con método, ruta, autenticación requerida, esquemas de request/response, códigos de error y eventos de auditoría emitidos. |
| [07-pruebas.md](./07-pruebas.md) | Estrategia de pruebas: pirámide, herramientas, política TDD estricta, umbrales de cobertura, ejemplos de tests unitarios y de componente, convenciones y CI. |
| [08-despliegue.md](./08-despliegue.md) | Guía de despliegue: variables de entorno, comandos de build, runtime de producción, opciones de hosting, cron de limpieza, HTTPS y estrategia de backups. |
| [09-bibliografia.md](./09-bibliografia.md) | Referencias bibliográficas en formato APA para todos los conceptos citados en el marco teórico (libros, papers, especificaciones y documentación oficial). |

---

> **Nota sobre la numeración:** Los documentos siguen el esquema de numeración del plan de tesis. El `03-` (diseño de UI/UX con wireframes) lo agrega el autor manualmente, ya que contiene imágenes generadas fuera de este repositorio.
