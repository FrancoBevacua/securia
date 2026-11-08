# Presentación funcional de Securia 2.3.4

Presentación funcional de la aplicación móvil Securia 2.3.4.

- `securia-2.3.4.json`: contenido editorial y referencias de capturas.
- `capturas/`: pantallas de Securia con datos de demostración. La imagen de la guía corresponde a Inicio en Android. Las demás vistas se obtuvieron en un entorno local de demostración.
- `generar_pdf.py`: genera un PDF A4 de 28 páginas con fuentes incrustadas, marcadores e índice navegable.

## Regenerar

Con las dependencias del proyecto instaladas y Python con `reportlab` y `Pillow`:

```powershell
python docs/gerencia/generar_pdf.py
```

La salida predeterminada es `output/pdf/Securia-2.3.4-Presentacion-funcional.pdf`. `--capturas` y `--salida` permiten cambiar las rutas. El generador rechaza imágenes faltantes y texto que exceda el área útil.

## Validación editorial

Se contrastaron las rutas, pantallas y reglas de dominio con el código actual. Se renderizaron las 28 páginas con Poppler y se comprobó el índice de 26 enlaces internos.

El PDF es un artefacto de entrega y permanece fuera del control de versiones, según las exclusiones del repositorio. Para nuevas versiones, actualizar contenido y capturas y repetir el renderizado y la revisión visual.
