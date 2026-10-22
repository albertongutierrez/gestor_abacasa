<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('accounts', function (Blueprint $t) {
            $t->id();
            $t->uuid('public_id')->unique();
            $t->foreignId('office_id')->constrained()->restrictOnDelete();
            $t->string('name');
            $t->string('document', 50)->nullable();
            $t->string('phone', 50)->nullable();
            $t->text('notes')->nullable();
            $t->timestamps();
            $t->index(['office_id', 'name']);
        });
        Schema::create('ledger_entries', function (Blueprint $t) {
            $t->id();
            $t->uuid('public_id')->unique();
            $t->foreignId('account_id')->constrained()->restrictOnDelete();
            $t->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $t->foreignId('source_id')->nullable()->constrained('ledger_entries')->restrictOnDelete();
            $t->string('kind', 20);
            $t->string('currency', 3);
            $t->date('date');
            $t->bigInteger('amount_minor');
            $t->text('comment')->nullable();
            $t->string('reference', 100)->nullable();
            $t->json('details')->nullable();
            $t->unsignedInteger('version')->default(1);
            $t->timestamps();
            $t->index(['account_id', 'currency', 'date', 'id']);
            $t->unique(['source_id', 'kind']);
        });
        Schema::create('ledger_audits', function (Blueprint $t) {
            $t->id();
            $t->foreignId('entry_id')->constrained('ledger_entries')->restrictOnDelete();
            $t->foreignId('user_id')->constrained('users')->restrictOnDelete();
            $t->json('before')->nullable();
            $t->json('after');
            $t->timestamp('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ledger_audits');
        Schema::dropIfExists('ledger_entries');
        Schema::dropIfExists('accounts');
    }
};
