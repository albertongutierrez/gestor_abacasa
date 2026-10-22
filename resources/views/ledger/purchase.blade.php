<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Compra V2 — {{ $purchase->reference ?: $purchase->account->name }}</title>
<style>
@page{size:A4 portrait;margin:14mm}body{font-family:DejaVu Sans,sans-serif;font-size:{{ $fontSize ?? 10 }}pt;color:#1e293b;margin:0}table{width:100%;border-collapse:collapse}h1{font-size:18pt;margin:0 0 5px}h2{font-size:13pt;margin:0 0 6px}p{margin:4px 0}.header{border-bottom:2px solid #17634d;padding-bottom:14px;margin-bottom:16px}.header td{vertical-align:top}.logo{width:70px}.company{padding-left:12px}.company p{font-size:8pt}.reference{text-align:right;width:28%}.meta td{vertical-align:top;width:50%;padding:10px 0 16px}.label{font-size:8pt;color:#64748b}.lines th{background:#f1f5f4;color:#526662;font-size:8pt;text-align:left;padding:9px 6px;border-bottom:1px solid #cbd5e1}.lines td{padding:12px 6px;border-bottom:1px solid #e2e8f0}.num{text-align:right!important}.bottom{margin-top:20px}.bottom td{vertical-align:top}.notes{width:45%;padding-right:20px;white-space:pre-wrap;overflow-wrap:break-word;word-wrap:break-word}.totals td{padding:8px 0}.final td{border-top:2px solid #17634d;color:#17634d;font-size:13pt;font-weight:bold}.footer{margin-top:24px;border-top:1px solid #e2e8f0;padding-top:10px;font-size:7pt;color:#64748b}
</style>
</head>
<body>
@php
    $details = $purchase->details;
    $item = $details['items'][0] ?? [];
    $hasDiscount = (float) ($item['discount'] ?? 0) > 0;
    $quantity = (float) ($item['quantity'] ?? 0);
    $transport = (float) ($details['transport'] ?? 0);
    $cost = (int) ($details['cost_minor'] ?? 0);
    $money = fn ($value, $currency = 'RD$') => $currency.' '.number_format($value, 2);
@endphp
<table class="header"><tr><td style="width:75px"><img class="logo" src="{{ $logoData }}"></td><td class="company"><h1>{{ $issuer['name'] }}</h1>@foreach($issuer['lines'] as $line)<p>{{ $line }}</p>@endforeach</td><td class="reference"><h2>COMPRA V2</h2>@if(!empty($details['cancelled_at']))<strong style="color:#b91c1c">CANCELADA</strong>@endif<p>{{ $purchase->reference ?: 'Sin referencia' }}</p><p class="label">Fecha: {{ \Carbon\Carbon::parse($purchase->date)->format('d/m/Y') }}</p></td></tr></table>
<table class="meta"><tr><td><span class="label">CUENTA / PROVEEDOR</span><h2>{{ $purchase->account->name }}</h2><p>Documento / RNC: {{ $purchase->account->document ?: '—' }}</p><p>Teléfono: {{ $purchase->account->phone ?: '—' }}</p></td><td><span class="label">DATOS DE LA COMPRA</span><p>Moneda del crédito: <strong>USD</strong></p><p>Precio del dólar: <strong>{{ $money((float) ($details['exchange_rate'] ?? 0)) }}</strong></p></td></tr></table>
<table class="lines"><thead><tr><th>Descripción</th><th class="num">Cantidad</th><th class="num">Precio</th>@if($hasDiscount)<th class="num">Descuento</th>@endif<th class="num">Importe</th></tr></thead><tbody>
<tr><td><strong>{{ $item['product'] ?? 'Producto' }}</strong></td><td class="num">{{ $quantity }} sacos</td><td class="num">{{ $money((float) ($item['price'] ?? 0), 'USD$') }}</td>@if($hasDiscount)<td class="num">{{ $money((float) ($item['discount'] ?? 0), 'USD$') }}</td>@endif<td class="num"><strong>{{ $money($purchase->amount_minor / 100, 'USD$') }}</strong></td></tr>
@if($transport > 0)<tr><td>Transporte</td><td class="num">{{ $quantity }}</td><td class="num">{{ $money($quantity > 0 ? $transport / $quantity : 0) }}</td>@if($hasDiscount)<td class="num">—</td>@endif<td class="num"><strong>{{ $money($transport) }}</strong></td></tr>@endif
</tbody></table>
<table class="bottom"><tr><td class="notes"><strong>Observaciones</strong><p>{{ $purchase->comment ?: 'Sin observaciones.' }}</p></td><td><table class="totals"><tr><td>Crédito al proveedor</td><td class="num"><strong>{{ $money($purchase->amount_minor / 100, 'USD$') }}</strong></td></tr><tr><td>Costo total del camión</td><td class="num"><strong>{{ $money($cost / 100) }}</strong></td></tr><tr class="final"><td>Costo Final<br><span class="label">Por saco</span></td><td class="num">{{ $quantity > 0 ? $money($cost / $quantity / 100) : '—' }}</td></tr></table></td></tr></table>
<p class="footer">El crédito se registra en USD. La tasa y el transporte se utilizan únicamente para calcular el costo.</p>
</body></html>