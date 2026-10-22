<?php
// Creates only this project's database and first local access. Existing users are never overwritten.
if (PHP_SAPI !== 'cli') exit(1);
require dirname(__DIR__).'/vendor/autoload.php';
$app = require dirname(__DIR__).'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();
$c = config('database.connections.mysql');
if ($c['database'] !== 'gestor_abacasa') throw new RuntimeException('Se esperaba la base exclusiva gestor_abacasa.');
$pdo = new PDO("mysql:host={$c['host']};port={$c['port']}", $c['username'], $c['password'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$pdo->exec('CREATE DATABASE IF NOT EXISTS gestor_abacasa CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
if ($kernel->call('migrate', ['--seed' => true, '--force' => true]) !== 0) { echo $kernel->output(); exit(1); }
echo $kernel->output();
if (App\Models\User::exists()) { echo "Usuarios existentes conservados.\n"; exit(0); }
Illuminate\Support\Facades\DB::transaction(function () {
    $office = App\Models\Office::create(['name' => 'ABACASA', 'is_active' => true]);
    $branch = App\Models\BranchOffice::create(['office_id' => $office->id, 'name' => 'Principal', 'code' => 'PRI', 'is_active' => true]);
    $password = bin2hex(random_bytes(8)).'Aa1!';
    $user = App\Models\User::create(['name' => 'Administrador ABACASA', 'email' => 'admin@abacasa.local', 'password' => $password, 'active_branch_office_id' => $branch->id]);
    $user->forceFill(['email_verified_at' => now()])->save();
    $user->roles()->attach(App\Models\Role::where('slug', 'super_admin')->value('id'), ['office_id' => null]);
    $user->branchOffices()->attach($branch, ['is_default' => true]);
    file_put_contents(dirname(__DIR__).'/.local-access.md', "# Acceso local ABACASA\n\nURL: http://127.0.0.1:8013\n\nCorreo: admin@abacasa.local\n\nContraseña: `$password`\n\nCambiar contraseña desde Perfil. No compartir este archivo.\n");
});
echo "Acceso local creado. Credenciales guardadas en .local-access.md\n";
