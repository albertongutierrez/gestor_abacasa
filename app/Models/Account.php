<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class Account extends Model
{
    protected $guarded = ['id'];

    protected static function booted(): void
    {
        static::creating(fn ($m) => $m->public_id ??= (string) Str::uuid());
    }

    public function entries()
    {
        return $this->hasMany(LedgerEntry::class);
    }
}
