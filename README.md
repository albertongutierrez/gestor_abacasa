# Gestor ABACASA

Sistema de cuentas en dólares (USD) y pesos dominicanos (DOP): créditos, débitos, compras V2 de maíz/soya, transporte, balances a favor, dashboard y estados de cuenta PDF. Incluye empresas, sucursales, usuarios y permisos.

## Tecnología

- PHP 8.5.12 y Laravel 13.38.0, verificados el 22/10/2026. Las versiones exactas de las librerías están en `composer.lock`.
- React 18, TypeScript, Inertia 2, TanStack Query, Tailwind CSS 4 y Vite 8.
- MySQL; SQLite en memoria para pruebas.
- Laravel Herd para ejecutar el proyecto localmente en Windows o macOS.

Los créditos y balances se mantienen separados por moneda. La tasa del dólar y el transporte se usan para calcular el costo de la compra, sin convertir la deuda USD a pesos. Los movimientos cancelados conservan auditoría.

## Instalar en otra computadora (Windows + Herd)

### 1. Requisitos

Instala [Git](https://git-scm.com/downloads) y [Laravel Herd](https://herd.laravel.com/windows). Abre Herd y actualízalo desde su aplicación. Instala PHP **8.5**, con el parche estable más reciente, desde PHP Versions. No selecciones versiones RC/beta.

Instala Node.js 24 LTS (o 22.12+ compatible) y MySQL 8.0/8.4. Puedes usar MySQL independiente, el servicio de XAMPP existente o MySQL en Herd Pro. **Herd gratuito no incluye un servidor MySQL**. No es necesario ejecutar Apache para servir el sitio con Herd.

Abre una terminal nueva y comprueba:

```powershell
herd --version
herd php:install 8.5
herd php:update 8.5
node --version
npm --version
git --version
```

PHP necesita BCMath, PDO MySQL, Mbstring, DOM/XML, cURL, Fileinfo, GD y Zip; las pruebas también requieren PDO SQLite. Verifica las extensiones con `herd php -m`.

### 2. Clonar y enlazar el sitio

```powershell
git clone https://github.com/albertongutierrez/gestor_abacasa.git
cd gestor_abacasa
Copy-Item .env.example .env
herd link gestor-abacasa --isolate=8.5
herd php -v
herd composer install
herd php artisan key:generate
```

Usa `herd php` y `herd composer` para evitar que un PHP anterior de XAMPP o del PATH ejecute el proyecto. `key:generate` se ejecuta **solo al crear una instalación nueva**, nunca al actualizar una existente.

### 3. Crear y configurar la base de datos

Crea una base nueva desde tu cliente MySQL:

```sql
CREATE DATABASE gestor_abacasa CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Edita `.env` con las credenciales de **esa computadora**:

```dotenv
APP_NAME="Gestor ABACASA"
APP_ENV=local
APP_DEBUG=true
APP_URL=http://gestor-abacasa.test
APP_TIMEZONE=America/Santo_Domingo
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=gestor_abacasa
DB_USERNAME=tu_usuario_mysql
DB_PASSWORD="tu_contrasena_mysql"
SESSION_SECURE_COOKIE=false
MAIL_MAILER=log
ALLOW_REGISTRATION=false
```

No copies contraseñas de ejemplos ni publiques `.env`. Si existe `.env.local` en Windows, el proyecto lo utiliza antes que `.env`; `APP_ENV_FILE` permite seleccionar explícitamente otro archivo. Para una instalación nueva, trabaja únicamente con `.env`.

### 4. Instalar las tablas, crear el administrador y compilar

```powershell
herd php artisan optimize:clear
herd php artisan migrate --seed
herd php artisan base:create-admin
herd php artisan storage:link
npm ci
npm run build
herd open gestor-abacasa
```

Abre **http://gestor-abacasa.test**. El comando de administrador solicita nombre, correo y contraseña sin mostrarla; no hay una contraseña pública predeterminada. Inicia sesión, crea la empresa y su sucursal, y selecciónala en el menú. Después configura usuarios, roles y permisos. El Logo 2 se usa en los PDFs y el detalle de compras.

Para HTTPS local, ejecuta `herd secure gestor-abacasa`, cambia `APP_URL=https://gestor-abacasa.test` y `SESSION_SECURE_COOKIE=true`, y ejecuta `herd php artisan optimize:clear`.

### 5. Correo y desarrollo

`MAIL_MAILER=log` guarda mensajes en `storage/logs/laravel.log`; no envía correos reales. Para recuperación de contraseña y verificación por correo, configura SMTP (`MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_ENCRYPTION`, `MAIL_FROM_ADDRESS`). No compartas los logs: pueden contener enlaces de recuperación.

Para modificar la interfaz, usa `npm run dev` con Herd abierto. Para usar el sitio sin el servidor de Vite, ejecuta `npm run build`. Si Vite se cerró de forma inesperada y el navegador intenta cargar recursos del puerto 5173, elimina solamente `public/hot` y vuelve a compilar.

## Actualizar una instalación existente

Respalda primero la base MySQL, `.env` y los archivos de `storage/app/public`. Git no contiene clientes, movimientos, usuarios, logos cargados ni credenciales.

```powershell
git pull --ff-only
herd php:update 8.5
herd isolate 8.5 --site=gestor-abacasa
herd composer install
npm ci
npm run build
herd php artisan migrate --seed
herd php artisan optimize:clear
```

Usa `composer install` para reproducir el lock publicado; `composer update` se reserva para actualizar dependencias deliberadamente. No uses `migrate:fresh` ni regeneres `APP_KEY` sobre datos existentes. La actualización desde Laravel 10 conserva la estructura de la aplicación y las tablas existentes.

## Migrar los datos a otra computadora

Para una copia con datos existentes, importa un respaldo MySQL en una base vacía y copia `storage/app/public`. Conserva el `APP_KEY` de la instalación original mediante un canal privado. Ajusta las credenciales de MySQL y `APP_URL` al nuevo equipo, ejecuta `storage:link`, `migrate --seed` y `optimize:clear`. No crees otro administrador si ya existe. El repositorio permite instalar el sistema, pero no sustituye el respaldo de sus datos.

## Verificación

```powershell
herd composer validate --strict
herd composer check-platform-reqs
herd php vendor/phpunit/phpunit/phpunit
npm run build
herd composer audit
```

Las pruebas fuerzan SQLite en memoria y no modifican MySQL. Cubren autenticación, permisos por empresa, CRUD, monedas, compras, correcciones, cancelaciones, créditos vinculados, dashboard y PDFs.

## Solución de problemas

- **PHP incompatible:** comprueba `herd php -v`; usa los comandos con prefijo `herd` aunque `php -v` siga mostrando la versión de XAMPP.
- **No conecta a MySQL:** inicia el servicio y comprueba host, puerto y credenciales. Herd y MySQL son servicios distintos.
- **No abre `.test`:** abre Herd, revisa `herd links` y vuelve a ejecutar `herd link gestor-abacasa --isolate=8.5` desde el proyecto.
- **Logo no visible:** ejecuta `herd php artisan storage:link`; en Windows puede requerir Modo desarrollador o terminal elevada para crear el enlace.
- **Error 419:** comprueba el dominio y `APP_URL`, las cookies seguras según HTTP/HTTPS y ejecuta `optimize:clear`; vuelve a iniciar sesión.
- **Error de permisos de escritura:** `storage` y `bootstrap/cache` deben permitir escritura al proceso PHP.

## Despliegue en servidor

Herd es un entorno **local**; publicar en Internet requiere un servidor o plataforma de hosting. Usa PHP 8.5, extensiones anteriores y MySQL, HTTPS y document root en `public/`. Configura `APP_ENV=production`, `APP_DEBUG=false`, `SESSION_SECURE_COOKIE=true`, el dominio real y credenciales propias.

El frontend se compila **localmente** y se publica con `public/build` completo en GitHub. El hosting descarga esos archivos: no necesita ejecutar npm ni compilar. Usa `bash scripts/deploy.sh --initial` para la primera instalación y `bash scripts/deploy.sh` para actualizar, con PHP 8.5 y Composer configurados. Conserva `APP_KEY`, datos y archivos subidos entre despliegues.

Consulta [la guía de hosting y deploy key](docs/DESPLIEGUE.md) para configurar SSH, la clave GitHub de solo lectura, el dominio, el entorno privado y los comandos completos.

## Documentación

- [Funcionamiento de cuentas](docs/CUENTAS.md)
- [Extender módulos y permisos](docs/EXTENDER.md)
- [Guía de actualización de Laravel 13](https://laravel.com/docs/13.x/upgrade)
- [PHP estable](https://www.php.net/downloads.php)
- [Laravel Herd para Windows](https://herd.laravel.com/windows)

## Estado de la actualización (22/10/2026)

Validado con PHP 8.5.12 de Herd, Laravel 13.38.0, 32 pruebas (442 comprobaciones), compilación de producción y respuesta HTTP del sitio local. `composer audit` no reportó avisos de seguridad.

Frontend actualizado a Vite 8.3.5 y Tailwind CSS 4.3.3, con sus plugins compatibles. Se retiró PDF.js porque no se utiliza: los PDF se generan en el servidor con Dompdf. `npm audit` y `composer audit` reportan **0 vulnerabilidades** en esta revisión. La compilación de producción y las 32 pruebas (442 comprobaciones) finalizan correctamente.

Tailwind 4 requiere navegadores modernos: Safari 16.4+, Chrome 111+ o Firefox 128+. Se conserva el tema claro/oscuro y la configuración de formularios del proyecto.

## Cierres por mes y producto (23/10/2026)

Compras V2 permite indicar el mes del producto. Las cuentas que utilizan compras habilitan los paneles Maíz/Soya, con pagos por mes y producto y saldo disponible sin aplicación automática. El pago puede combinar saldo a favor y dinero nuevo sin duplicar débitos. Consulta las reglas de datos históricos y correcciones en [Cuentas](docs/CUENTAS.md#cierre-por-mes-y-producto-en-compras-v2). Validado con 42 pruebas (537 comprobaciones), compilación de producción y revisión de la interfaz a 390 px.
