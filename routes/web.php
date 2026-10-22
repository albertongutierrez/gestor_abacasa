<?php

use App\Http\Controllers\ProfileController;
use App\Http\Controllers\Settings\ActiveBranchOfficeController;
use App\Http\Controllers\Settings\BranchOfficeController;
use App\Http\Controllers\Settings\OfficeController;
use App\Http\Controllers\Settings\RoleController;
use App\Http\Controllers\Settings\UserController;
use App\Http\Middleware\EnsureActiveBranch;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::redirect('/', '/login');

Route::middleware(['auth', EnsureActiveBranch::class])->group(function () {
    Route::get('/dashboard', \App\Http\Controllers\DashboardController::class)->middleware('verified')->name('dashboard');
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');
    Route::patch('/settings/active-branch-office', [ActiveBranchOfficeController::class, 'update'])->name('settings.active-branch-office.update');
    Route::middleware(['verified', 'permission.route'])->prefix('settings')->name('settings.')->group(function () {
        Route::resource('offices', OfficeController::class)->except('show');
        Route::resource('branch-offices', BranchOfficeController::class)->except('show');
        Route::resource('users', UserController::class)->except('show');
        Route::resource('roles', RoleController::class)->except('show');
    });
});

require __DIR__.'/auth.php';

Route::middleware(['auth', 'verified', EnsureActiveBranch::class, 'permission.route'])->prefix('ledger')->name('ledger.')->group(function () {
    Route::get('/', [\App\Http\Controllers\LedgerController::class, 'index'])->name('index');
    Route::get('/purchases', [\App\Http\Controllers\LedgerController::class, 'purchases'])->name('purchases');
    Route::get('/purchases/{entry}', [\App\Http\Controllers\LedgerController::class, 'purchaseShow'])->name('purchases.show');
    Route::post('/purchases/{entry}/cancel', [\App\Http\Controllers\LedgerController::class, 'purchaseCancel'])->name('purchases.cancel');
    Route::post('/debits/{entry}/cancel', [\App\Http\Controllers\LedgerController::class, 'debitCancel'])->name('debits.cancel');
    Route::post('/credits/{entry}/cancel', [\App\Http\Controllers\LedgerController::class, 'creditCancel'])->name('credits.cancel');
    Route::get('/purchases/{entry}/print', [\App\Http\Controllers\LedgerController::class, 'purchasePrint'])->name('purchases.print');
    Route::post('/accounts', [\App\Http\Controllers\LedgerController::class, 'account'])->name('accounts.store');
    Route::put('/accounts/{account}', [\App\Http\Controllers\LedgerController::class, 'account'])->name('accounts.update');
    Route::post('/accounts/{account}/entries', [\App\Http\Controllers\LedgerController::class, 'store'])->name('store');
    Route::put('/accounts/{account}/entries/{entry}', [\App\Http\Controllers\LedgerController::class, 'update'])->name('update');
    Route::get('/accounts/{account}/statement', [\App\Http\Controllers\LedgerController::class, 'print'])->name('print');
});
