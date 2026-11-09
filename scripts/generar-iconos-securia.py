"""Regenera los iconos de distribución a partir de la geometría de la marca.

Uso: python scripts/generar-iconos-securia.py (requiere PyMuPDF).
"""

import json
from pathlib import Path

import pymupdf


ROOT = Path(__file__).resolve().parents[1]
DESTINO = ROOT / 'assets' / 'securia'
MARCA = json.loads((ROOT / 'src' / 'marcaSecuria.json').read_text(encoding='utf-8'))


def svg(*, fondo=None, radio=0, adaptable=False, monocromo=False):
    caja = 108 if adaptable else 64
    plano = f'<rect width="{caja}" height="{caja}" rx="{radio}" fill="{fondo}"/>\n' if fondo else ''
    trazo = '#FFFFFF' if monocromo else MARCA['trazo']
    acento = '#FFFFFF' if monocromo else MARCA['acento']
    simbolo = (
        f'<path d="{MARCA["monograma"]}" fill="{trazo}"/>\n'
        f'<path d="{MARCA["registro"]}" fill="{acento}"/>\n'
    )
    if adaptable:
        simbolo = '<g transform="translate(18.8 18.8) scale(1.1)">\n' + simbolo + '</g>\n'
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 {caja} {caja}">\n'
        + plano + simbolo + '</svg>\n'
    )


def png(nombre, vector, pixeles, *, transparencia):
    with pymupdf.open(stream=vector.encode('utf-8'), filetype='svg') as documento:
        escala = pixeles / 1024
        imagen = documento[0].get_pixmap(matrix=pymupdf.Matrix(escala, escala), alpha=transparencia)
        imagen.save(str(DESTINO / nombre))


if __name__ == '__main__':
    marca = svg(fondo=MARCA['fondo'], radio=14)
    adaptable = svg(adaptable=True)
    monocromo = svg(adaptable=True, monocromo=True)
    for nombre, contenido in [('logo.svg', marca), ('adaptable.svg', adaptable), ('monocromo.svg', monocromo)]:
        (DESTINO / nombre).write_text(contenido, encoding='utf-8')
    png('icon.png', svg(fondo=MARCA['fondo']), 1024, transparencia=False)
    png('adaptive-icon.png', adaptable, 1024, transparencia=True)
    png('monochrome.png', monocromo, 1024, transparencia=True)
    png('splash-icon.png', adaptable, 512, transparencia=True)
    png('favicon.png', marca, 64, transparencia=True)
