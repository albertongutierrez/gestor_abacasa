import { useState } from 'react';

const format = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

export default function MoneyInput({value, onChange, className, max = '999999999.99', min = '0.01'}: {
    value: string;
    onChange: (value: string) => void;
    className?: string;
    max?: string;
    min?: string;
}) {
    const [editing, setEditing] = useState(false);
    const number = Number(value);
    return <input
        className={className}
        type="text"
        inputMode="decimal"
        required
        placeholder="0.00"
        value={editing || value === '' || !Number.isFinite(number) ? value : format.format(number)}
        onFocus={() => setEditing(true)}
        onChange={event => {
            const raw = event.target.value.replace(/,/g, '');
            if (/^\d*(?:\.\d{0,2})?$/.test(raw)) {
                event.target.setCustomValidity('');
                onChange(raw);
            }
        }}
        onBlur={event => {
            setEditing(false);
            if (value !== '' && (!Number.isFinite(number) || number < Number(min) || number > Number(max))) {
                event.target.setCustomValidity(`Ingresa un monto entre ${min} y ${format.format(Number(max))}.`);
            } else {
                event.target.setCustomValidity('');
                if (value !== '') onChange(number.toFixed(2));
            }
        }}
    />;
}
