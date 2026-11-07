# Securia

## Repositorio y ramas

- El repositorio oficial es `https://github.com/FrancoBevacua/securia` y su remoto local es `origin`.
- `main` representa producción: debe contener versiones verificadas. La base inicial es Securia 2.3.2 (código Android 27).
- Los próximos cambios se preparan en ramas `codex/<descripcion>`, con commits y pushes a este repositorio. El repositorio anterior `vigelium` queda como referencia histórica y no recibe cambios nuevos.
- Al finalizar trabajo autorizado, conservar los cambios en commits y subir la rama a `origin`. Integrar y publicar en producción según el alcance autorizado por el usuario; este archivo no agrega pedidos de confirmación.

## Validación

- Móvil y dominio compartido: `npm run typecheck` y `npm test`.
- Panel web: `npm ci --prefix admin` y `npm run build --prefix admin`.
- Los módulos de `admin/shared` se generan con `admin/scripts/sync-shared.mjs`; no editarlos manualmente.
- Para cambios de teclado, modales o chat, probar Android con navegación de tres botones y teclado abierto, durante el envío y después de recibir la respuesta.
- Compilar APK con `compilar.ps1`. Verificar que conserve paquete y firma y que aumente `versionCode`. Instalar sobre la anterior, sin borrar datos.

## Configuración privada y datos

- No versionar `.env`, `src/provisionCorporativa.ts`, claves de firma, credenciales, bases locales, copias de registros, builds, APK ni carpetas temporales.
- La configuración de ejemplo debe contener sólo valores vacíos o ficticios. Las claves publicables del cliente no reemplazan la autorización del servidor.
- Preservar historial, autoría, firmas y pendientes de sincronización. Las pruebas de servidor deben usar datos ficticios y revertir sus cambios.
- Las claves de firma y la provisión del corporativo siguen en el entorno autorizado. Una copia nueva del repositorio necesita esa configuración privada para generar una actualización instalable sobre la existente.
