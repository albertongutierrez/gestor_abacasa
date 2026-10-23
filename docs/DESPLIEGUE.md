# Despliegue en hosting compartido

El frontend se compila en la computadora de desarrollo. `public/build` y su manifest se suben completos a GitHub. **El servidor no necesita Node, npm ni Vite**. El script usa Bash, Git, Composer, PHP 8.5 y MySQL. Si tu hosting no ofrece SSH/Composer o PHP 8.5, este procedimiento requiere adaptar la instalación al panel y cargar un paquete con `vendor` preparado fuera del hosting.

## Datos para cPanel

El dominio previsto es `abacasa.pdv.com.do`. En **Dominios**, crea o configura el subdominio con raíz `abacasa.pdv.com.do/public` relativa al directorio de tu cuenta, sin compartir la raíz del dominio principal. Configura su DNS y AutoSSL. En **MultiPHP Manager** selecciona PHP 8.5 para ese dominio.

Desde **Avanzado → Terminal**, comprueba las rutas antes de desplegar:

```bash
pwd
php -v
command -v composer
ls -d /opt/cpanel/ea-php*/root/usr/bin/php 2>/dev/null
```

En servidores EasyApache con PHP 8.5 instalado, una ruta habitual es `/opt/cpanel/ea-php85/root/usr/bin/php`; comprueba que exista y su versión. CloudLinux u otros proveedores pueden utilizar rutas diferentes. Si Terminal no aparece, solicita acceso SSH al proveedor. Crea la base y su usuario desde **MySQL Databases** o **Manage My Databases**, asigna permisos a esa base y configura las credenciales en el archivo de entorno privado.

## 1. Preparar el dominio y PHP

- Configura PHP 8.5 tanto en el dominio como en la terminal. Suelen ser ejecutables diferentes: pide al hosting la ruta de PHP CLI y del script `composer` o `composer.phar`.
- El proyecto completo debe quedar fuera de la carpeta pública. Configura el document root del dominio como `/home/USUARIO/abacasa.pdv.com.do/public`. Esta es la única carpeta que debe servir el dominio. Si el panel obliga a usar `public_html`, confirma primero cómo cambiar el document root o enlazar esa carpeta a `public`; no copies el proyecto completo dentro.
- Activa HTTPS, crea la base MySQL y su usuario. Permite escritura en `storage` y `bootstrap/cache` al usuario PHP. No uses permisos 777.
- Antes de actualizar una instalación existente, respalda la base, el archivo de entorno y `storage/app/public` desde el panel o tu sistema de copias.

## 2. Crear la deploy key en el hosting

Sube `scripts/setup-deploy-key.sh` a tu directorio privado mediante el panel/SFTP y ejecútalo en la terminal SSH:

```bash
bash setup-deploy-key.sh
```

GitHub se conecta por SSH mediante `ssh.github.com:443`, porque este hosting rechaza el puerto 22.

El script crea `~/.ssh/abacasa_github_ed25519` y muestra únicamente la clave pública `.pub`. No reemplaza claves existentes. En [GitHub → Settings → Deploy keys](https://github.com/albertongutierrez/gestor_abacasa/settings/keys), pulsa **Add deploy key**, título `Hosting ABACASA`, pega la clave pública y deja **Allow write access desmarcado**. La privada permanece en el hosting; no se sube al repositorio ni se comparte por chat.

Conecta a GitHub y verifica su huella contra las [huellas oficiales](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/githubs-ssh-key-fingerprints) antes de aceptarla:

```bash
ssh -i ~/.ssh/abacasa_github_ed25519 -o IdentitiesOnly=yes -T -p 443 git@ssh.github.com
```

GitHub confirma la autenticación y avisa que no proporciona shell; puede terminar con código 1 aunque la autenticación sea correcta.

Si `abacasa.pdv.com.do` ya contiene archivos del hosting, conserva su `.env` y clona en una carpeta temporal vacía; copia después con `cp -an ORIGEN/. /home/USUARIO/abacasa.pdv.com.do/`. No borres ni sobrescribas los archivos existentes. El siguiente ejemplo supone que el directorio destino todavía no existe.

```bash
cd ~
GIT_SSH_COMMAND="ssh -i $HOME/.ssh/abacasa_github_ed25519 -o IdentitiesOnly=yes" \
  git clone ssh://git@ssh.github.com:443/albertongutierrez/gestor_abacasa.git abacasa.pdv.com.do
cd abacasa.pdv.com.do
git config core.sshCommand "ssh -i $HOME/.ssh/abacasa_github_ed25519 -o IdentitiesOnly=yes"
```

## 3. Configurar el entorno privado

```bash
cp -n .env.example .env
chmod 600 .env
```

Edita `.env` con los datos del hosting, sin publicarlos:

```dotenv
APP_ENV=production
APP_DEBUG=false
APP_URL=https://abacasa.pdv.com.do
APP_KEY=
DB_CONNECTION=mysql
DB_HOST=localhost
DB_PORT=3306
DB_DATABASE=BASE_DEL_HOSTING
DB_USERNAME=USUARIO_DEL_HOSTING
DB_PASSWORD="CONTRASEÑA_PRIVADA"
SESSION_SECURE_COOKIE=true
ALLOW_REGISTRATION=false
```

Configura también el correo SMTP para recuperar contraseñas. En una instalación con datos existentes, importa su respaldo y conserva su `APP_KEY` y sus archivos. No ejecutes `migrate:fresh`.

Por defecto el despliegue usa `.env`. Si el dominio usa `.env.test` por la configuración actual de `bootstrap/app.php`, utiliza `DEPLOY_ENV_FILE=.env.test` en **todos** los comandos de despliegue y administración para que terminal y web utilicen la misma base y clave.

## 4. Primer despliegue

Sustituye las rutas con las del hosting; `COMPOSER_BIN` debe apuntar al script PHP de Composer, no a un wrapper de shell:

```bash
export PHP_BIN=/RUTA/DEL/HOSTING/php
export COMPOSER_BIN=/RUTA/DEL/HOSTING/composer.phar
bash scripts/deploy.sh --check
bash scripts/deploy.sh --initial
"$PHP_BIN" artisan base:create-admin
```

`--initial` genera `APP_KEY` solamente si está vacía. No crea credenciales públicas. El script instala las dependencias exactas de `composer.lock`, migra las tablas, sincroniza los permisos/roles del sistema, enlaza los archivos y genera las cachés de producción. Nunca compila el frontend en el hosting. Comprueba `/login`, acceso, logos y descarga de PDF desde el dominio.

## 5. Publicar cambios posteriores

En la computadora de desarrollo, desde la raíz del proyecto:

```powershell
npm ci
npm run build
herd php scripts/verify-build.php
herd php vendor/phpunit/phpunit/phpunit
git add app bootstrap config database resources routes scripts docs public/build README.md composer.json composer.lock package.json package-lock.json vite.config.js tailwind.config.js postcss.config.js
git commit -m "Describe el cambio"
git push origin main
```

Revisa lo añadido antes del commit; incluye los nuevos hashes y las eliminaciones de `public/build`. No subas `.env`, claves SSH, logs, datos ni archivos de clientes.

En la terminal SSH del hosting, después del respaldo:

```bash
cd /home/sruostyg/abacasa.pdv.com.do
export PHP_BIN=/RUTA/DEL/HOSTING/php
export COMPOSER_BIN=/RUTA/DEL/HOSTING/composer.phar
bash scripts/deploy.sh
```

El script admite `DEPLOY_BRANCH` (por defecto `main`) y `DEPLOY_ENV_FILE` (por defecto `.env`). Rechaza cambios locales y ramas divergentes. Actualiza con fast-forward y mantiene el sitio en mantenimiento durante la instalación. Si falla después de activarlo, conserva el mantenimiento para permitir corregir y repetir el despliegue; no revierte tablas automáticamente. No borres el bloqueo de `.git/abacasa-deploy.lock` mientras otra ejecución esté activa.

Si una migración falla, revisa primero su error y el respaldo. Solo ejecuta `php artisan up` manualmente después de verificar que aplicación y esquema son compatibles. Un rollback de Git no deshace cambios de base de datos.

Referencias: [Deploy keys de GitHub](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/managing-deploy-keys), [despliegue de Laravel](https://laravel.com/framework/docs/13.x/deployment).

Referencias cPanel: [acceso a Terminal](https://docs.cpanel.net/knowledge-base/general-server-administration/how-to-access-the-command-line/), [PHP CLI](https://support.cpanel.net/hc/en-us/articles/360050224413-How-to-run-PHP-commands-as-a-cPanel-user-via-Terminal).
