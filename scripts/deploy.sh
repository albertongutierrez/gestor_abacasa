#!/usr/bin/env bash
# Run from SSH: PHP_BIN=/path/to/php bash scripts/deploy.sh [--initial|--check]
# Frontend assets arrive compiled through Git; this script never invokes npm.
set -Eeuo pipefail
umask 027

fail() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
MODE="${1:-update}"
case "$MODE" in update|--initial|--check) ;; *) fail 'Uso: bash scripts/deploy.sh [--initial|--check]' ;; esac
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
cd "$ROOT"
PHP_BIN="${PHP_BIN:-php}"
BRANCH="${DEPLOY_BRANCH:-main}"
export APP_ENV_FILE="${DEPLOY_ENV_FILE:-.env}"
[[ "$APP_ENV_FILE" =~ ^\.env([.][a-zA-Z0-9_-]+)?$ ]] || fail 'DEPLOY_ENV_FILE debe ser .env o .env.nombre dentro del proyecto.'
command -v git >/dev/null || fail 'El hosting necesita Git.'
command -v "$PHP_BIN" >/dev/null || fail 'Configura PHP_BIN con el ejecutable PHP 8.5 del hosting.'
COMPOSER_BIN="${COMPOSER_BIN:-$(command -v composer || true)}"
[[ -n "$COMPOSER_BIN" && -f "$COMPOSER_BIN" ]] || fail 'Configura COMPOSER_BIN con la ruta del script Composer o composer.phar.'
[[ -f "$APP_ENV_FILE" ]] || fail "Configura $APP_ENV_FILE antes de desplegar. Consulta docs/DESPLIEGUE.md."
"$PHP_BIN" -r '
    if (PHP_VERSION_ID < 80500 || PHP_VERSION_ID >= 90000) { fwrite(STDERR, "Se requiere PHP 8.5 o posterior de la serie 8.x.\n"); exit(1); }
    foreach (["bcmath", "ctype", "curl", "dom", "fileinfo", "filter", "gd", "mbstring", "openssl", "pdo_mysql", "session", "tokenizer", "xml", "zip"] as $extension) {
        if (!extension_loaded($extension)) { fwrite(STDERR, "Falta la extensión PHP: $extension\n"); exit(1); }
    }
'
git rev-parse --is-inside-work-tree >/dev/null
[[ "$(git branch --show-current)" == "$BRANCH" ]] || fail "Selecciona primero la rama $BRANCH."
[[ -z "$(git status --porcelain)" ]] || fail 'Hay cambios locales. Revísalos antes de actualizar; el script no los sobrescribe.'
[[ ! -e public/hot ]] || fail 'Elimina public/hot: producción debe usar public/build.'
"$PHP_BIN" scripts/verify-build.php
if [[ "$MODE" == --check ]]; then
    printf 'Requisitos locales correctos. No se modificó el sitio ni se comprobó todavía el acceso remoto.\n'
    exit 0
fi

LOCK="$(git rev-parse --git-path abacasa-deploy.lock)"
mkdir "$LOCK" 2>/dev/null || fail "Ya hay un despliegue activo. Si fue interrumpido, revisa y elimina $LOCK."
MAINTENANCE=0
cleanup() {
    local status=$?
    rmdir "$LOCK" 2>/dev/null || true
    if (( status != 0 )); then
        printf 'Despliegue interrumpido. Corrige el error y vuelve a ejecutar el script.\n' >&2
        if (( MAINTENANCE )); then printf 'El sitio permanece en mantenimiento hasta completar la actualización.\n' >&2; fi
    fi
}
trap cleanup EXIT
git fetch --no-tags origin "$BRANCH"
TARGET="$(git rev-parse FETCH_HEAD)"
git merge-base --is-ancestor HEAD "$TARGET" || fail 'La rama local diverge del servidor; resuélvelo antes de desplegar.'
git cat-file -e "$TARGET:public/build/manifest.json" || fail 'La versión remota no incluye el frontend compilado.'
if [[ -f vendor/autoload.php ]]; then
    "$PHP_BIN" artisan down --retry=60
    MAINTENANCE=1
fi
git merge --ff-only "$TARGET"
"$PHP_BIN" scripts/verify-build.php
mkdir -p bootstrap/cache storage/app/public storage/framework/cache/data storage/framework/sessions storage/framework/views storage/logs
"$PHP_BIN" "$COMPOSER_BIN" install --no-dev --prefer-dist --optimize-autoloader --no-interaction
"$PHP_BIN" "$COMPOSER_BIN" check-platform-reqs --no-dev
"$PHP_BIN" artisan config:clear
"$PHP_BIN" -r '
    require "vendor/autoload.php";
    $app = require "bootstrap/app.php";
    $app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
    if (!$app->environment("production") || config("app.debug") || !str_starts_with(config("app.url", ""), "https://") || !config("session.secure")) {
        fwrite(STDERR, "Configura APP_ENV=production, APP_DEBUG=false, APP_URL=https://... y SESSION_SECURE_COOKIE=true.\n"); exit(1);
    }
    if (!config("app.key") && ($argv[1] ?? "") !== "--initial") {
        fwrite(STDERR, "Falta APP_KEY. Para una instalación nueva utiliza --initial; para una existente restaura su clave original.\n"); exit(1);
    }
' -- "$MODE"
if [[ "$MODE" == --initial ]]; then
    # Generate only when empty. Never replace the key of an existing installation.
    "$PHP_BIN" -r 'require "vendor/autoload.php"; $a = require "bootstrap/app.php"; $a->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap(); exit(config("app.key") ? 0 : 2);' || {
        status=$?
        [[ "$status" == 2 ]] || exit "$status"
        "$PHP_BIN" artisan key:generate --force
    }
fi
"$PHP_BIN" artisan migrate --force
"$PHP_BIN" artisan db:seed --force
if [[ ! -e public/storage && ! -L public/storage ]]; then "$PHP_BIN" artisan storage:link; fi
"$PHP_BIN" artisan config:cache
"$PHP_BIN" artisan route:cache
"$PHP_BIN" artisan view:cache
"$PHP_BIN" artisan up
MAINTENANCE=0
printf 'Despliegue completado: %s\nComprueba /login y un PDF desde el dominio.\n' "$(git rev-parse --short HEAD)"
