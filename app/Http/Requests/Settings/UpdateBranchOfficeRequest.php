<?php

namespace App\Http\Requests\Settings;

use App\Models\BranchOffice;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateBranchOfficeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        /** @var BranchOffice|null $branchOffice */
        $branchOffice = $this->route('branchOffice');
        $officeId = $this->input('office_id');

        return [
            'office_id' => ['required', 'integer', Rule::exists('offices', 'id')->whereNull('deleted_at')],
            'name' => ['required', 'string', 'max:120'],
            'code' => [
                'required',
                'string',
                'max:20',
                Rule::unique('branch_offices', 'code')
                    ->ignore($branchOffice?->id)
                    ->where('office_id', $officeId)
                    ->whereNull('deleted_at'),
            ],
            'phone' => ['nullable', 'string', 'max:30'],
            'mobile_phone' => ['nullable', 'string', 'max:30'],
            'email' => ['nullable', 'email', 'max:120'],
            'address' => ['nullable', 'string', 'max:500'],
            'is_main' => ['boolean'],
            'is_active' => ['boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'office_id.required' => 'Debes seleccionar una empresa.',
            'office_id.exists' => 'La empresa seleccionada no existe.',
            'name.required' => 'El nombre de la sucursal es obligatorio.',
            'code.required' => 'El codigo de la sucursal es obligatorio.',
            'code.unique' => 'Ya existe una sucursal con ese codigo para esta empresa.',
            'email.email' => 'El correo no tiene un formato valido.',
        ];
    }
}
