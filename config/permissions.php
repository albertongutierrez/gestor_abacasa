<?php

$crud = fn ($module, $label) => array_map(fn ($action, $verb) => [
    'module' => $module, 'name' => "$verb $label", 'slug' => "$module.$action",
], ['view', 'create', 'update', 'delete'], ['Ver', 'Crear', 'Editar', 'Eliminar']);

$routes = ['dashboard' => 'dashboard.view'];
foreach (['users' => 'users', 'offices' => 'settings.offices', 'branch-offices' => 'settings.branch-offices'] as $resource => $permission) {
    foreach (['index' => 'view', 'create' => 'create', 'store' => 'create', 'edit' => 'update', 'update' => 'update', 'destroy' => 'delete'] as $action => $ability) {
        $routes["settings.$resource.$action"] = "$permission.$ability";
    }
}
$routes['settings.roles.index'] = 'roles.view';
$routes['settings.roles.*'] = 'roles.manage';
$routes['ledger.index'] = 'ledger.view';
$routes['ledger.purchases'] = 'ledger.view';
$routes['ledger.purchases.show'] = 'ledger.view';
$routes['ledger.purchases.cancel'] = 'ledger.purchase.update';
$routes['ledger.debits.cancel'] = 'ledger.debit.update';
$routes['ledger.credits.cancel'] = 'ledger.credit.update';
$routes['ledger.purchases.print'] = 'ledger.export';
$routes['ledger.print'] = 'ledger.export';
$routes['ledger.accounts.store'] = 'ledger.accounts.create';
$routes['ledger.accounts.update'] = 'ledger.accounts.update';
$routes['ledger.store'] = ['ledger.purchase.create', 'ledger.credit.create', 'ledger.debit.create'];
$routes['ledger.update'] = ['ledger.purchase.update', 'ledger.credit.update', 'ledger.debit.update'];
$ledger = [];
foreach (['purchase' => 'compras V2', 'credit' => 'créditos', 'debit' => 'débitos', 'accounts' => 'clientes / proveedores'] as $key => $label) {
    foreach (['create' => 'Crear', 'update' => 'Editar'] as $action => $verb) {
        $ledger[] = ['module' => 'ledger', 'name' => "$verb $label", 'slug' => "ledger.$key.$action"];
    }
}

return [
    'definitions' => [
        ...$ledger,
        ['module' => 'ledger', 'name' => 'Ver estados de cuenta', 'slug' => 'ledger.view'],
        ['module' => 'ledger', 'name' => 'Imprimir estados de cuenta', 'slug' => 'ledger.export'],
        ['module' => 'dashboard', 'name' => 'Ver inicio', 'slug' => 'dashboard.view'],
        ...$crud('users', 'usuarios'),
        ...$crud('settings.offices', 'empresas'),
        ...$crud('settings.branch-offices', 'sucursales'),
        ['module' => 'roles', 'name' => 'Ver roles', 'slug' => 'roles.view'],
        ['module' => 'roles', 'name' => 'Administrar roles', 'slug' => 'roles.manage'],
        ['module' => 'company', 'name' => 'Ver todos los registros de la empresa', 'slug' => 'company.data.view_all'],
    ],
    'route_permissions' => $routes,
];
