# Gestor ABACASA

Sistema de créditos y débitos en USD y DOP, con compras V2, costeo de transporte, créditos vinculados, correcciones auditadas y estados por fechas.

Guía del sistema y acceso local: [docs/CUENTAS.md](docs/CUENTAS.md). Iniciar con `powershell -File scripts/start-local.ps1` y abrir http://127.0.0.1:8013. Credenciales en `.local-access.md`.

## Documentación original de la plantilla

Base independiente extraida de ENLACE para iniciar aplicaciones nuevas. No es una copia de la base de datos del sistema de facturacion.

## Incluye

- Laravel 10, PHP, MySQL, React 18, TypeScript, Inertia, Tailwind, Vite, Ziggy y Lucide. Se conservan los archivos de bloqueo de dependencias del proyecto original.
- Login, cerrar sesion, recordarme, limitacion de intentos, recuperacion de contrasena, cambio de contrasena y verificacion de correo.
- Perfil, empresas con logos, sucursales, selector de sucursal activa, usuarios y roles con permisos por empresa.
- Super administrador global, administrador por empresa y roles personalizados. IDs publicos no secuenciales.
- Interfaz adaptable, modo claro/oscuro, filtros, paginacion, confirmaciones, notificaciones y retorno contextual.
- Migracion inicial limpia, permisos base idempotentes, pruebas aisladas y recursos de frontend compilados.

No incluye clientes, productos, inventario, POS, facturas, compras, caja, financiamientos, reportes comerciales, integraciones DGII, credenciales, logs ni archivos de empresas. Las librerias PDF/ESC-POS del archivo de dependencias se conservan por compatibilidad, pero no hay modulos de impresion ni servicios fiscales activos.

## Crear un proyecto

Extrae el ZIP en una carpeta nueva. Requisitos: PHP 8.1+ compatible con el lock (probado con 8.3), Composer 2, MySQL/MariaDB y Node compatible con Vite 5. PHP necesita las extensiones usuales de Laravel, PDO MySQL, mbstring, XML, curl, fileinfo, GD, zip y bcmath. Para pruebas, habilita PDO SQLite.

```powershell
cd C:\ruta\mi-proyecto
Copy-Item .env.example .env
composer install
php artisan key:generate
```

Configura una **base de datos nueva y vacia** en `.env`: `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD`. No utilices la base de ENLACE. Cambia `APP_NAME`, `APP_URL`, `SESSION_COOKIE`, `VITE_APP_NAME` y el correo de salida.

```bash
php artisan migrate --seed
php artisan base:create-admin
php artisan storage:link
npm ci
npm run build
php artisan serve --host=127.0.0.1 --port=8012
```

El comando solicita la contrasena sin mostrarla y no crea empresas ni usuarios de ejemplo. Crea primero una empresa y luego su sucursal desde el menu. El super administrador puede seleccionar cualquier sucursal activa; los demas solo sus accesos autorizados.

Los usuarios creados desde Usuarios deben verificar su correo. El primer super administrador creado por consola queda verificado. El registro publico esta desactivado; `ALLOW_REGISTRATION=true` habilita el registro y verificacion, pero **no** asigna empresa, sucursal o permisos automaticamente.

## Revision local rapida

Solo en una copia nueva, sin `.env`, con Composer y npm instalados:

```bash
composer install
php -d extension=pdo_sqlite scripts/init-local.php
npm ci
npm run build
php -d extension=pdo_sqlite -S 127.0.0.1:8012 -t public scripts/serve.php
```

Esto usa SQLite exclusivamente en `database/local.sqlite`, genera una clave y contrasena aleatorias y deja las credenciales en `.local-access.md`. No toca MySQL. Si PDO SQLite ya esta habilitado, omite `-d extension=pdo_sqlite`. La copia inicial queda sin empresas ni sucursales. El ZIP nunca incluye este entorno local.

## Correo

Configura `MAIL_MAILER=smtp`, host, puerto, credenciales y `MAIL_FROM_ADDRESS` para enviar mensajes reales. Por defecto `MAIL_MAILER=log`: las notificaciones se escriben en `storage/logs/laravel.log`, no se envian a Internet. No compartas esos logs porque contienen enlaces de acceso. Revisa `APP_URL` antes de probar recuperacion y verificacion.

## Permisos y nuevos modulos

Consulta [docs/EXTENDER.md](docs/EXTENDER.md). El middleware comprueba permisos en el servidor y deniega rutas sin politica. Ocultar un boton no reemplaza esta comprobacion.

Los roles estan asociados a `office_id` en `role_user`; un permiso en una empresa no se hereda en otra. El super administrador es global. Un administrador no puede editar un usuario compartido con otra empresa, modificar roles globales ni delegar permisos que no tiene. Los roles inactivos no conceden acceso. Las empresas se administran solo por super administrador.

## Pruebas

```bash
php -d extension=pdo_sqlite vendor/phpunit/phpunit/phpunit
npm run build
```

PHPUnit fuerza SQLite en memoria, sin acceder a la base de trabajo. Las pruebas verifican autenticacion, recuperacion, correo, instalacion, CRUD base, permisos, sucursales y limites entre empresas.

## Produccion

Configura el dominio con document root en `public/`. Nunca publiques la raiz del proyecto. Usa HTTPS, `APP_ENV=production`, `APP_DEBUG=false`, `SESSION_SECURE_COOKIE=true`, un `APP_KEY` propio y credenciales SMTP/BD propias. `storage` y `bootstrap/cache` necesitan permisos de escritura; no uses 777.

Instala dependencias con `composer install --no-dev --optimize-autoloader`, aplica migraciones y ejecuta `php artisan optimize:clear`. No regeneres `APP_KEY` en despliegues posteriores. Compila localmente con `npm ci && npm run build` y publica `public/build` completo. Esta plantilla incluye el build inicial; cambiar `VITE_APP_NAME` requiere recompilar.

Mantiene las versiones del sistema de origen, no promete ser la ultima version ni sustituye una revision de seguridad. Antes de lanzar un proyecto nuevo revisa soporte de Laravel/PHP y ejecuta `composer audit` y `npm audit`; prueba las actualizaciones en una rama aparte.

## Empaquetar de nuevo

```bash
php scripts/package.php ../mi-plantilla.zip
```

El empaquetado usa una lista explicita de carpetas, incluye los compilados y excluye `.env`, claves, base local, credenciales, archivos subidos, caches, logs, `vendor`, `node_modules` y el historial Git. El ZIP no sobrescribe archivos existentes.

# gestor_abacasa
