<?php

// Local preview only. Never reads or modifies another project's environment.
$root = dirname(__DIR__);
if (PHP_SAPI !== 'cli' || file_exists($root.'/.env')) {
    fwrite(STDERR, "Se requiere CLI y una carpeta sin .env. No se ha modificado nada.\n");
    exit(1);
}
if (! in_array('sqlite', PDO::getAvailableDrivers(), true)) {
    fwrite(STDERR, "Habilita pdo_sqlite o ejecuta php -d extension=pdo_sqlite scripts/init-local.php\n");
    exit(1);
}
$key = base64_encode(random_bytes(32));
$database = str_replace('\\', '/', $root.'/database/local.sqlite');
if (file_exists($database)) {
    fwrite(STDERR, "La base local ya existe.\n");
    exit(1);
}
touch($database);
$env = file_get_contents($root.'/.env.example');
$env = preg_replace('/^APP_KEY=.*$/m', 'APP_KEY=base64:'.$key, $env);
$env = preg_replace('/^DB_CONNECTION=.*$/m', 'DB_CONNECTION=sqlite', $env);
$env = preg_replace('/^DB_DATABASE=.*$/m', 'DB_DATABASE="'.$database.'"', $env);
file_put_contents($root.'/.env', $env);
require $root.'/vendor/autoload.php';
$app = require $root.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();
if ($kernel->call('migrate', ['--seed' => true, '--force' => true]) !== 0) {
    fwrite(STDERR, $kernel->output());
    exit(1);
}
$password = bin2hex(random_bytes(12)).'Aa1';
$user = App\Models\User::create(['name' => 'Administrador', 'email' => 'admin@example.test', 'password' => $password]);
$user->forceFill(['email_verified_at' => now()])->save();
$user->roles()->attach(App\Models\Role::where('slug', 'super_admin')->value('id'), ['office_id' => null]);
file_put_contents($root.'/.local-access.md', "# Acceso local\n\nURL: http://127.0.0.1:8012\n\nCorreo: admin@example.test\n\nContrasena: `$password`\n\nSolo para esta copia local. Cambia el correo y la contrasena en Perfil. Este archivo, la base y el .env no se incluyen en Git ni en el ZIP.\n");
echo "Copia local preparada sin empresas ni sucursales. Credenciales en .local-access.md\n";
