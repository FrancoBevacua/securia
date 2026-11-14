# Presentaciones de Securia 2.3.7

- **Funcional**. 28 páginas con índice navegable y descripción de cada herramienta.
- **Ejecutiva**. 7 páginas para presentar el ingreso, los permisos y la operación de una jornada.

`securia-2.3.7.json` contiene el texto de ambas versiones. Las capturas utilizan datos de demostración. El archivo editorial de la versión 2.3.4 se conserva como referencia histórica.

## Regenerar

Con las dependencias del proyecto instaladas y Python con ReportLab y Pillow:

```powershell
python docs/gerencia/generar_pdf.py
python docs/gerencia/generar_pdf.py --formato ejecutiva
```

Los PDFs se guardan en `output/pdf/`. `--capturas` y `--salida` permiten elegir otras rutas. El generador comprueba las capturas requeridas y el área útil de la página. Las dos ediciones incluyen fuentes incrustadas y marcadores.
