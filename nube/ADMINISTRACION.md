# Acceso de administración en Securia

La app muestra un único teclado de seis dígitos. El servidor elige entre Guardia de Paseo y Administrador según el PIN ingresado. El panel web acepta el PIN de la cuenta Administrador.

## Activación inicial

Aplicá las migraciones de separación de administración y de cuenta independiente. Creá la cuenta Administrador del objetivo con un PIN de seis dígitos distinto del PIN de Guardia de Paseo.

Desde una conexión SQL autorizada, ejecutá la siguiente consulta con parámetros enlazados. `$1` es el identificador del objetivo y `$2` el PIN de Administrador. El procedimiento guarda un verificador y crea la cuenta con rol de administrador. Usá el PIN sólo en el mecanismo autorizado de configuración de secretos.

```sql
select guardia_private.crear_administrador_pin($1::uuid, $2::text);
```

Verificá que el PIN de Guardia de Paseo abra el ingreso operativo y que el PIN de Administrador habilite las opciones de administración. En **Más → Cuenta del corporativo** el administrador puede actualizar el PIN de Guardia de Paseo.

El PIN del administrador se puede cambiar desde **Mi perfil** en la app.
