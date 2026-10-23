# Gestor ABACASA

Aplicación basada en plantilla-base, instalada en una carpeta y base MySQL independientes.

## Acceso local

- URL: http://gestor-abacasa.test
- Credenciales del administrador: `.local-access.md` (excluido de Git).
- Base MySQL: `gestor_abacasa`. Configuración de conexión en `.env`.
- Para iniciar nuevamente: `powershell -File scripts/start-local.ps1` desde este proyecto. Requiere MySQL activo.
- La empresa ABACASA y su sucursal Principal están creadas. No se importaron clientes ni movimientos de otros sistemas.

## Operación

Abrir Estados de cuenta y crear un cliente/proveedor. Las cuentas son compartidas entre sucursales de la misma empresa; nunca entre empresas. Buscar por nombre o documento y seleccionar la cuenta.

Los créditos aumentan el balance pendiente y los débitos lo disminuyen. Un resultado negativo representa saldo a favor. USD y DOP se calculan por separado, sin conversiones entre balances. Las tarjetas muestran el total de todos los movimientos; la tabla muestra el período seleccionado, con saldo inicial, débitos, créditos y cierre.

Compra V2 permite un solo producto por compra: maíz o soya, con cantidad, precio y descuento absoluto en USD. Incluye por defecto una línea de transporte en RD$ que toma automáticamente la cantidad del producto. Se introduce únicamente el precio unitario del transporte; se deja en cero si no aplica o ya está incluido. Transporte total = cantidad del producto × precio unitario del transporte, redondeado a centavos. Costo del camión = mercancía USD × tasa + transporte total RD$. Costo por unidad = costo del camión / cantidad del producto. No genera inventario ni impuestos: es un registro de crédito y costeo.

En un débito, elegir conservar el excedente o devolverlo. La devolución se registra como movimiento positivo separado en la misma moneda, calculado contra el saldo inmediatamente anterior a ese abono según fecha e ID. Nunca devuelve saldo a favor preexistente: devuelve como máximo el monto del nuevo abono. Registrar una devolución significa que el usuario confirma que ese dinero fue devuelto; la aplicación no mueve dinero bancario.

La casilla de crédito vinculado crea un crédito a otra cuenta de la misma empresa y moneda, por todo el débito o un importe menor. Tiene un comentario independiente. Se guarda junto con el débito dentro de una transacción.

El lápiz corrige compras, créditos y débitos. Los créditos vinculados y devoluciones se corrigen desde el débito de origen; el enlace de la tabla lleva a su fecha y cuenta. Desmarcar el crédito vinculado deja el registro en cero, fuera del estado, y conserva su auditoría. Una corrección anterior actualiza los balances posteriores, pero no reescribe devoluciones históricas de otros abonos. Una edición desactualizada se rechaza para evitar sobrescribir cambios de otro usuario.

## Cierre por mes y producto en Compras V2

La compra tiene **fecha del movimiento** y **mes del producto** independientes. El mes se guarda como año/mes y se presenta en español en el listado, detalle y PDF. Las compras anteriores sin mes guardado usan el mes de su fecha; se pueden corregir con el permiso habitual de editar compras.

Cuando la cuenta tiene historial de compras V2, Estados de cuenta agrega las pestañas **Maíz** y **Soya** en la misma fila que **Dólares** y **Pesos**. Cada producto muestra su estado en tabla, con compras, pagos aplicados y balance, filtrado por mes del producto. No utiliza bloques ni un selector de vista separado. El estado general conserva el balance neto y los movimientos de dinero; el panel muestra por separado las compras pendientes y el saldo disponible sin aplicar. El panel usa el mes del producto, independientemente del período por fechas del estado general.

Los débitos en USD de estas cuentas requieren mes y producto. El formulario consulta el pendiente y el saldo disponible a la fecha del pago. Permite seleccionar cuánto saldo utilizar y agregar dinero nuevo. Solo el dinero nuevo aumenta el débito contable: reutilizar saldo no vuelve a descontarlo del estado general. Un pago puede usar únicamente saldo disponible indicando cero en dinero nuevo.

Ejemplo: hay USD$200 disponibles y USD$500 pendientes de maíz en octubre. Al utilizar USD$200 y agregar USD$100, se aplican USD$300 a octubre/maíz y quedan USD$200 pendientes; el nuevo débito de dinero es USD$100. Si el pago supera el pendiente, el excedente de dinero nuevo queda disponible sin aplicar o se registra su devolución, según lo elegido. No se asigna automáticamente a otro mes ni a soya. El crédito vinculado a otra cuenta usa únicamente el dinero nuevo.

Los pagos anteriores sin mes/producto permanecen sin asignación. Su dinero, descontados otros créditos y devoluciones de la cuenta, queda disponible. Para asignarlos, edita el pago indicando el destino; también puedes registrar una aplicación nueva con dinero nuevo cero. Nunca se adivina a qué producto correspondía un pago histórico. USD y DOP siguen independientes: el saldo en pesos no financia compras en dólares.

Las aplicaciones se auditan con el pago y usan los permisos existentes de crear/editar débitos, consultar estados y exportar PDF. Se verifican en una transacción con bloqueo por empresa. No se permite gastar el mismo saldo dos veces, consumir saldo de una fecha futura ni cancelar/reducir una compra o un pago que deje aplicaciones posteriores sin respaldo. En ese caso hay que corregir o cancelar primero las aplicaciones afectadas. Los pagos cancelados dejan de consumir saldo y se conserva su auditoría.

Los datos nuevos se guardan en los detalles JSON de los movimientos existentes. Esta actualización no requiere alterar tablas ni convertir los datos históricos. Para actualizar en cPanel, usa `/home/sruostyg/abacasa.pdv.com.do` y `bash scripts/deploy.sh`; el frontend llega compilado desde GitHub.

## Estados de cuenta

Filtros: mes actual, mes anterior, trimestre calendario actual y fechas personalizadas inclusivas. El saldo anterior incluye todos los movimientos anteriores a la fecha inicial. Estado imprimible abre ambas monedas por separado; usar Imprimir / guardar PDF para descargar desde el navegador.

## Permisos

En Roles y permisos, módulo `ledger`: ver estados, imprimir, crear/editar cuentas, crear/editar compras, crear/editar créditos y crear/editar débitos. La autorización se verifica en el servidor por empresa activa. Crear un débito vinculado exige también crear créditos; corregirlo exige editar créditos. Los roles personalizados no reciben permisos nuevos automáticamente. El rol Administrador incluye estos permisos y el Super administrador tiene acceso global, siempre dentro de la empresa seleccionada.

## Verificación técnica

El módulo utiliza TanStack Query v5 para consultar datos JSON y guardar con mutaciones. Las claves de caché incluyen usuario, sucursal, cuenta y período. Al guardar una cuenta o movimiento se invalidan las consultas de esa sucursal, incluyendo créditos vinculados. Los importes se confirman desde el servidor; no se aplican balances optimistas. Las consultas se cancelan cuando dejan de usarse y se actualizan al volver a la ventana o recuperar conexión. Las mutaciones no se reintentan automáticamente. Los errores de validación permanecen en el formulario y los de sesión, permisos o cambio de sucursal se muestran al usuario. Inertia conserva la navegación y el estado local de formularios. Las rutas JSON usan los mismos permisos y filtros de empresa que las vistas originales. No se guarda la caché financiera en almacenamiento persistente del navegador.

`php -d extension=pdo_sqlite vendor/phpunit/phpunit/phpunit` ejecuta pruebas en SQLite en memoria, sin modificar MySQL. `npm run build` comprueba TypeScript y genera el frontend.

La persistencia usa centavos enteros y BCMath para el costeo, bloqueo por empresa para serializar escrituras relacionadas, claves foráneas, versión por movimiento y `ledger_audits` con usuario y valores anteriores/nuevos. La auditoría se conserva en base de datos; no hay una pantalla de auditoría en esta entrega.

Antes de publicar, configurar document root en `public`, HTTPS, correo SMTP y entorno de producción según la guía de la plantilla. El servidor local se limita a 127.0.0.1.
