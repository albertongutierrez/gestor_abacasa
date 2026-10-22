#!/usr/bin/env bash
# Exercise the deployment lifecycle in a disposable repository. No database or
# Composer installation is used; PHP -r calls use the real PHP CLI parser.
set -Eeuo pipefail
SOURCE="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
REAL_PHP="${PHP_BIN:-php}"
export REAL_PHP
mkdir -p "$SOURCE/artifacts"
TEST_ROOT="$(mktemp -d "$SOURCE/artifacts/deployment-cli.XXXXXX")"
git init -q --bare "$TEST_ROOT/remote.git"
git clone -q "$TEST_ROOT/remote.git" "$TEST_ROOT/site" 2>/dev/null
cd "$TEST_ROOT/site"
git config user.name 'Deployment test'
git config user.email 'deployment@example.invalid'
git config core.autocrlf false
git checkout -qb main
mkdir -p scripts public/build/assets vendor bootstrap
cp "${DEPLOY_SCRIPT:-$SOURCE/scripts/deploy.sh}" scripts/deploy.sh
cp "$SOURCE/scripts/verify-build.php" scripts/
printf '{"resources/js/app.tsx":{"file":"assets/app.js"}}\n' > public/build/manifest.json
touch public/build/assets/app.js "$TEST_ROOT/composer.phar"
printf '.env\nvendor/\nstorage/\nbootstrap/cache/\npublic/storage\n' > .gitignore
printf 'APP_ENV=production\n' > .env
cat > vendor/autoload.php <<'PHP'
<?php
function config($key, $default = null) {
    return ["app.debug" => false, "app.url" => "https://example.invalid", "session.secure" => true,
        "app.key" => is_file("vendor/generated-key") ? "existing-key" : null][$key] ?? $default;
}
PHP
cat > bootstrap/app.php <<'PHP'
<?php
return new class {
    public function make($contract) { return $this; }
    public function bootstrap() {}
    public function environment($name) { return $name === "production"; }
};
PHP
git add .
git commit -qm 'Fixture'
git push -qu origin main
cat > "$TEST_ROOT/php-shim" <<'SH'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "$TEST_LOG"
if [[ "$1" == -r || "$1" == scripts/verify-build.php ]]; then exec "$REAL_PHP" "$@"; fi
if [[ "$*" == 'artisan key:generate --force' ]]; then touch vendor/generated-key; fi
if [[ "$*" == 'artisan migrate --force' && "${FAIL_MIGRATE:-0}" == 1 ]]; then exit 42; fi
SH
chmod +x "$TEST_ROOT/php-shim"
export PHP_BIN="$TEST_ROOT/php-shim" COMPOSER_BIN="$TEST_ROOT/composer.phar" TEST_LOG="$TEST_ROOT/commands.log"
trap 'status=$?; if (( status )); then cat "$TEST_ROOT"/*.log >&2; fi' EXIT
bash scripts/deploy.sh --check > "$TEST_ROOT/check.log" 2>&1
if grep -q '^artisan ' "$TEST_LOG"; then exit 1; fi
: > "$TEST_LOG"
bash scripts/deploy.sh --initial > "$TEST_ROOT/initial.log" 2>&1
[[ -f vendor/generated-key ]]
[[ "$(grep -c '^artisan key:generate --force$' "$TEST_LOG")" == 1 ]]
grep -q '^artisan up$' "$TEST_LOG"
: > "$TEST_LOG"
bash scripts/deploy.sh --initial > "$TEST_ROOT/repeat.log" 2>&1
if grep -q '^artisan key:generate' "$TEST_LOG"; then exit 1; fi
: > "$TEST_LOG"
bash scripts/deploy.sh > "$TEST_ROOT/update.log" 2>&1
grep -q '^artisan migrate --force$' "$TEST_LOG"
grep -q '^artisan up$' "$TEST_LOG"
: > "$TEST_LOG"
if FAIL_MIGRATE=1 bash scripts/deploy.sh > "$TEST_ROOT/failure.log" 2>&1; then exit 1; fi
if grep -q '^artisan up$' "$TEST_LOG"; then exit 1; fi
[[ ! -d .git/abacasa-deploy.lock ]]
printf 'dirty\n' >> scripts/verify-build.php
if bash scripts/deploy.sh > "$TEST_ROOT/dirty.log" 2>&1; then exit 1; fi
printf 'PASS: real PHP CLI, initial key generation, existing key preservation, update, maintenance on failure, dirty checkout, lock cleanup.\n'
