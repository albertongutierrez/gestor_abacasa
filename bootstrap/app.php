<?php

/*
|--------------------------------------------------------------------------
| Create The Application
|--------------------------------------------------------------------------
|
| The first thing we will do is create a new Laravel application instance
| which serves as the "glue" for all the components of Laravel, and is
| the IoC container for the system binding all of the various parts.
|
*/

$app = new Illuminate\Foundation\Application(
    $_ENV['APP_BASE_PATH'] ?? dirname(__DIR__)
);

$environmentFile = $_SERVER['APP_ENV_FILE']
    ?? $_ENV['APP_ENV_FILE']
    ?? getenv('APP_ENV_FILE')
    ?: null;

if ($environmentFile) {
    $app->loadEnvironmentFrom($environmentFile);
} elseif (in_array(strtolower(strtok($_SERVER['HTTP_HOST'] ?? $_SERVER['SERVER_NAME'] ?? '', ':')), ['test.pdv.com.do'], true)
    && file_exists(dirname(__DIR__).'/.env.test')) {
    $app->loadEnvironmentFrom('.env.test');
} elseif (PHP_OS_FAMILY === 'Windows' && file_exists(dirname(__DIR__).'/.env.local')) {
    $app->loadEnvironmentFrom('.env.local');
}

/*
|--------------------------------------------------------------------------
| Bind Important Interfaces
|--------------------------------------------------------------------------
|
| Next, we need to bind some important interfaces into the container so
| we will be able to resolve them when needed. The kernels serve the
| incoming requests to this application from both the web and CLI.
|
*/

$app->singleton(
    Illuminate\Contracts\Http\Kernel::class,
    App\Http\Kernel::class
);

$app->singleton(
    Illuminate\Contracts\Console\Kernel::class,
    App\Console\Kernel::class
);

$app->singleton(
    Illuminate\Contracts\Debug\ExceptionHandler::class,
    App\Exceptions\Handler::class
);

/*
|--------------------------------------------------------------------------
| Return The Application
|--------------------------------------------------------------------------
|
| This script returns the application instance. The instance is given to
| the calling script so we can separate the building of the instances
| from the actual running of the application and sending responses.
|
*/

return $app;
