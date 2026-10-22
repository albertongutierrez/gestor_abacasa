<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class LedgerEntry extends Model
{
    protected $guarded = ['id'];

    protected $casts = ['details' => 'array', 'amount_minor' => 'integer', 'version' => 'integer'];

    protected static function booted(): void
    {
        static::creating(fn ($m) => $m->public_id ??= (string) Str::uuid());
    }

    public function account()
    {
        return $this->belongsTo(Account::class);
    }

    public function children()
    {
        return $this->hasMany(self::class, 'source_id');
    }

    public function source()
    {
        return $this->belongsTo(self::class, 'source_id');
    }
}
