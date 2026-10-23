<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class LedgerRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $decimal = ['numeric', 'min:0.01', 'max:999999999.99', 'regex:/^\d+(\.\d{1,2})?$/'];

        return [
            'kind' => ['required', Rule::in(['purchase', 'credit', 'debit'])],
            'currency' => ['required', Rule::in(['USD', 'DOP'])],
            'date' => ['required', 'date_format:Y-m-d'],
            'amount' => ['required_unless:kind,purchase', 'nullable', 'numeric', 'min:0', 'max:999999999.99', 'regex:/^\d+(\.\d{1,2})?$/'],
            'settlement_month' => ['required_if:kind,purchase', 'nullable', 'date_format:Y-m'],
            'product' => ['nullable', Rule::in(['Maíz', 'Soya'])],
            'credit_used' => ['nullable', 'numeric', 'min:0', 'max:999999999.99', 'regex:/^\d+(\.\d{1,2})?$/'],
            'comment' => ['nullable', 'string', 'max:4000'], 'reference' => ['nullable', 'string', 'max:100'],
            'version' => ['nullable', 'integer', 'min:1'],
            'excess' => ['required_if:kind,debit', Rule::in(['keep', 'refund'])],
            'linked' => ['required', 'boolean'],
            'linked_account' => ['nullable', 'required_if:linked,true', 'uuid'],
            'linked_mode' => ['nullable', 'required_if:linked,true', Rule::in(['full', 'custom'])],
            'linked_amount' => ['nullable', 'required_if:linked_mode,custom', ...$decimal],
            'linked_comment' => ['nullable', 'string', 'max:4000'],
            'items' => ['required_if:kind,purchase', 'array', 'max:1'],
            'items.*.product' => ['required', Rule::in(['Maíz', 'Soya'])],
            'items.*.unit' => ['required', Rule::in(['quintal', 'tonelada', 'libra', 'kg'])],
            'items.*.quantity' => ['required', 'numeric', 'min:0.0001', 'max:1000000', 'regex:/^\d+(\.\d{1,4})?$/'],
            'items.*.price' => ['required', ...$decimal],
            'items.*.discount' => ['required', 'numeric', 'min:0', 'max:999999999.99', 'regex:/^\d+(\.\d{1,2})?$/'],
            'exchange_rate' => ['required_if:kind,purchase', 'nullable', 'numeric', 'min:0.0001', 'max:10000', 'regex:/^\d+(\.\d{1,4})?$/'],
            'transport_price' => ['required_if:kind,purchase', 'nullable', 'numeric', 'min:0', 'max:999999999.99', 'regex:/^\d+(\.\d{1,8})?$/'],
        ];
    }
}
