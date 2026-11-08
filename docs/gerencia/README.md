# Presentación funcional de Securia 2.3.4

Documento para gerencia y supervisión, elaborado sobre los fuentes locales de la versión 2.3.4 (Android 29).

- `securia-2.3.4.json`: contenido editorial y referencias de capturas.
- `capturas/`: imágenes de componentes reales con datos ficticios, obtenidas en un entorno web local con adaptadores para servicios nativos. No contienen registros corporativos.
- `generar_pdf.py`: genera un PDF A4 de 30 páginas, con fuentes incrustadas, marcadores e índice navegable.

## Regenerar

Con las dependencias del proyecto instaladas y Python con `reportlab` y `Pillow`:

```powershell
python docs/gerencia/generar_pdf.py
```

La salida predeterminada es `output/pdf/Securia-2.3.4-Presentacion-funcional.pdf`. `--capturas` y `--salida` permiten cambiar las rutas. El generador rechaza imágenes faltantes y texto que exceda el área útil.

## Validación editorial

Se contrastaron rutas, pantallas, reglas de dominio y contenido de la guía con los fuentes actuales. Se renderizaron las 30 páginas con Poppler y se revisaron visualmente la disposición, las capturas, la tipografía y la paginación. Se comprobaron extracción de texto e índice con 28 enlaces internos. No se modificó la aplicación ni se probaron servicios corporativos para crear el documento.

El PDF es un artefacto de entrega y permanece fuera del control de versiones, según las exclusiones del repositorio. Para nuevas versiones, actualizar contenido y capturas y repetir el renderizado y la revisión visual.
