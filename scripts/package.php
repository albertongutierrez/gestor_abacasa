<?php

// An allowlist keeps environments, uploads, databases and logs out of the starter ZIP.
$root = dirname(__DIR__);
$output = $argv[1] ?? $root.'/plantilla-base.zip';
if (file_exists($output)) {
    fwrite(STDERR, "El archivo destino ya existe. Elige otro nombre.\n");
    exit(1);
}
$zip = new ZipArchive;
if ($zip->open($output, ZipArchive::CREATE | ZipArchive::EXCL) !== true) {
    exit(1);
}
$directories = ['app', 'config', 'database/factories', 'database/migrations', 'database/seeders', 'lang', 'resources', 'routes', 'tests', 'scripts', 'docs', 'public/build'];
$files = ['.env.example', '.gitignore', '.gitattributes', '.editorconfig', 'README.md', 'artisan', 'composer.json', 'composer.lock', 'package.json', 'package-lock.json', 'vite.config.js', 'postcss.config.js', 'tailwind.config.js', 'tsconfig.json', 'phpunit.xml', 'bootstrap/app.php', 'public/index.php', 'public/.htaccess'];
foreach ($directories as $dir) {
    if (! is_dir($root.'/'.$dir)) {
        continue;
    }
    $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root.'/'.$dir, FilesystemIterator::SKIP_DOTS));
    foreach ($iterator as $file) {
        if ($file->isFile() && ! $file->isLink()) {
            $files[] = str_replace('\\', '/', substr($file->getPathname(), strlen($root) + 1));
        }
    }
}
foreach (array_unique($files) as $file) {
    if (is_file($root.'/'.$file)) {
        $zip->addFile($root.'/'.$file, 'plantilla-base/'.$file);
    }
}
foreach (['bootstrap/cache', 'storage/app/public', 'storage/framework/cache/data', 'storage/framework/sessions', 'storage/framework/views', 'storage/logs'] as $dir) {
    $zip->addFromString('plantilla-base/'.$dir.'/.gitignore', "*\n!.gitignore\n");
}
$zip->close();
echo $output.PHP_EOL;
