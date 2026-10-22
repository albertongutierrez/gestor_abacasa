<?php

// This check runs before Composer, so it must not depend on vendor/.
$root = dirname(__DIR__);
try {
    $manifest = json_decode(file_get_contents($root.'/public/build/manifest.json'), true, 512, JSON_THROW_ON_ERROR);
    if (empty($manifest['resources/js/app.tsx']['file'])) {
        throw new RuntimeException('Falta la entrada principal del frontend.');
    }
    $buildRoot = realpath($root.'/public/build');
    foreach ($manifest as $entry) {
        foreach (array_merge([$entry['file'] ?? ''], $entry['css'] ?? [], $entry['assets'] ?? []) as $asset) {
            $path = realpath($root.'/public/build/'.$asset);
            if (! $asset || ! $path || ! is_file($path) || ! str_starts_with($path, $buildRoot.DIRECTORY_SEPARATOR)) {
                throw new RuntimeException('Archivo compilado ausente o inválido: '.$asset);
            }
        }
        foreach (array_merge($entry['imports'] ?? [], $entry['dynamicImports'] ?? []) as $import) {
            if (! isset($manifest[$import])) {
                throw new RuntimeException('Importación ausente en el manifest: '.$import);
            }
        }
    }
    echo "Frontend compilado: archivos completos.\n";
} catch (Throwable $error) {
    fwrite(STDERR, "Frontend inválido: ".$error->getMessage()." Ejecuta npm ci y npm run build localmente y sube public/build completo.\n");
    exit(1);
}
