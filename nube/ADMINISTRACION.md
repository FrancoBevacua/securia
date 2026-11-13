# Acceso de administración en Securia 2.3.6

La app y el panel web identifican al administrador por su DNI y su PIN personal de seis dígitos. Guardia Paseo sigue usando su PIN corporativo para el trabajo diario.

## Activación inicial

Aplicá la migración de separación de administración y activá al menos una cuenta personal con DNI antes de poner el nuevo panel en servicio. Hacé ambos pasos en la misma ventana de mantenimiento. Elegí una cuenta existente del objetivo.

Desde una conexión SQL autorizada, ejecutá la siguiente consulta con parámetros enlazados. `$1` es el identificador del objetivo, `$2` el identificador de la cuenta personal y `$3` un PIN personal nuevo de seis números. El procedimiento guarda un verificador y revoca los tokens anteriores de esa cuenta. Usá el PIN sólo en el mecanismo autorizado de configuración de secretos.

```sql
select guardia_private.activar_administrador($1::uuid, $2::text, $3::text);
```

Verificá el ingreso desde **Administrador** en la app y desde el panel. En **Más → Cuenta del corporativo** el administrador puede asignar un nuevo PIN de Guardia Paseo. Si el PIN compartido anterior también se usaba en la cuenta personal, asigná valores distintos.

El PIN del administrador se puede cambiar desde **Mi perfil** en la app.
