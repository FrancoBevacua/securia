"""Genera la presentación. Requiere reportlab y Pillow; capturas en --capturas."""
import argparse, json, re
from pathlib import Path
from xml.sax.saxutils import escape
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, Color, white
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import ImageReader
from PIL import Image

ROOT=Path(__file__).resolve().parents[2]
NAVY='#0B183C'; RED='#E92F51'; BLUE='#204AA0'; INK='#17233C'; MUTED='#53647D'; LIGHT='#EEF3FA'
W,H=595.276,841.89

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--capturas',default=str(Path(__file__).parent/'capturas'));ap.add_argument('--salida',default=str(ROOT/'output/pdf/Securia-2.3.4-Presentacion-funcional.pdf'));args=ap.parse_args()
    data=json.loads((Path(__file__).parent/'securia-2.3.4.json').read_text(encoding='utf-8'))
    for name,weight in [('Plex','400Regular'),('PlexBold','600SemiBold')]:
        file=ROOT/f'node_modules/@expo-google-fonts/ibm-plex-sans/{weight}/IBMPlexSans_{weight}.ttf'
        pdfmetrics.registerFont(TTFont(name,str(file)))
    out=Path(args.salida);out.parent.mkdir(parents=True,exist_ok=True)
    c=canvas.Canvas(str(out),pagesize=(W,H),pageCompression=1)
    c.setTitle('Securia 2.3.4 | Presentación funcional');c.setAuthor('Securia | Documento de presentación');c.setSubject('Funcionalidades de la aplicación móvil')
    total=len(data['paginas'])+2
    def text(s,x,y,width,size=11,color=INK,bold=False,leading=None):
        style=ParagraphStyle('p',fontName='PlexBold' if bold else 'Plex',fontSize=size,leading=leading or size*1.42,textColor=HexColor(color),spaceAfter=0)
        p=Paragraph(escape(s).replace('\n','<br/>'),style);pw,ph=p.wrap(width,1000);p.drawOn(c,x,y-ph);return y-ph
    def base(page,section):
        c.setFillColor(white);c.rect(0,0,W,H,fill=1,stroke=0)
        c.setFillColor(HexColor(NAVY));c.rect(0,H-12,W,12,fill=1,stroke=0)
        c.setFillColor(HexColor(RED));c.rect(0,H-12,98,12,fill=1,stroke=0)
        text('SECURIA',42,H-30,150,11,NAVY,True)
        text('PRESENTACIÓN FUNCIONAL  /  2.3.4',W-277,H-31,235,8,MUTED)
        c.setStrokeColor(HexColor('#D7E0EC'));c.line(42,49,W-42,49)
        text(data['fecha'],42,38,420,8,MUTED)
        text(f'{page:02d} / {total:02d}',W-90,38,50,8,MUTED)
        c.bookmarkPage('p'+str(page));c.addOutlineEntry(section,'p'+str(page),level=0,closed=False)
    # Portada
    c.setFillColor(HexColor(NAVY));c.rect(0,0,W,H,fill=1,stroke=0)
    c.setFillColor(HexColor('#102650'));c.circle(540,680,240,fill=1,stroke=0)
    c.setFillColor(HexColor('#183C73'));c.circle(590,740,160,fill=1,stroke=0)
    c.setFillColor(HexColor(RED));c.rect(42,740,58,5,fill=1,stroke=0)
    c.saveState()
    borde=c.beginPath();borde.roundRect(42,600,94,94,20.6)
    c.clipPath(borde,stroke=0,fill=0)
    c.drawImage(str(ROOT/'assets/securia/icon.png'),42,600,94,94)
    c.restoreState()
    text('SECURIA',42,570,510,52,'#FFFFFF',True)
    text('Cada novedad, bajo control.',44,498,500,18,'#BCD0EF')
    text('Presentación\nfuncional',42,420,510,36,'#FFFFFF',True,43)
    text('Aplicación móvil para el servicio de vigilancia',44,310,500,15,'#CEDAF0')
    for i,(a,b) in enumerate([('OPERACIÓN','Registro del servicio'),('INFORMES','Consulta y exportación'),('CONTINUIDAD','Historial compartido')]):
        x=42+i*174;c.setFillColor(HexColor('#152D56'));c.roundRect(x,132,162,78,10,fill=1,stroke=0);text(a,x+13,192,145,9,'#F77791',True);text(b,x+13,168,140,11,'#FFFFFF')
    text('VERSIÓN 2.3.4  ·  '+data['fecha'],42,91,500,11,'#FFFFFF',True)
    text('Producto desarrollado por Franco Daniel Bevacua',42,62,500,9,'#BACBE7')
    c.showPage()
    # Índice
    base(2,'Índice');text('Contenido',42,755,510,30,NAVY,True)
    text('Panorama del producto, catálogo de funciones y condiciones de uso.',42,706,510,11,MUTED)
    pages=data['paginas'];n=(len(pages)+1)//2
    for i,p in enumerate(pages):
        col=i//n;row=i%n;x=42+col*266;y=650-row*37
        text(f'{i+1:02d}',x,y,26,11,RED,True)
        text(p['titulo'],x+32,y,205,10.2,INK,True,13)
        c.linkRect('', 'p'+str(i+3),(x,y-28,x+238,y+3),relative=0,thickness=0)
    c.setFillColor(HexColor(LIGHT));c.roundRect(42,65,511,40,7,fill=1,stroke=0)
    text('Las capturas muestran pantallas de Securia con datos de demostración.',54,94,487,9,MUTED)
    c.showPage()
    # Catálogo funcional
    overflows=[]
    for i,p in enumerate(pages):
        num=i+3;base(num,p['titulo'])
        text(f'{i+1:02d}  /  SECURIA EN DETALLE',42,762,510,9,RED,True)
        y=text(p['titulo'],42,734,512,25,NAVY,True,30)-10
        y=text(p['bajada'],42,y,510,11.5,MUTED)-24
        imagepath=Path(args.capturas)/(p.get('imagen','')+'.png')
        has=imagepath.is_file()
        if p.get('imagen') and not has:raise FileNotFoundError(imagepath)
        leyenda_informe=p.get('leyenda_informe')
        captura_lateral=has and not leyenda_informe
        bodyw=306 if captura_lateral else 511
        if captura_lateral:
            x=370;iw=183;ih=iw*Image.open(imagepath).height/Image.open(imagepath).width
            c.setFillColor(HexColor(LIGHT));c.roundRect(x-6,y-ih-6,iw+12,ih+12,10,fill=1,stroke=0)
            c.drawImage(ImageReader(str(imagepath)),x,y-ih,width=iw,height=ih)
            caption='Captura de Securia en Android' if p.get('captura_android') else 'Vista de Securia'
            text(caption+'\nDatos de demostración',x,y-ih-18,iw,8,MUTED)
        for title,body in p['bloques']:
            y=text(title,42,y,bodyw,11,BLUE,True)-(1 if leyenda_informe else 4)
            leading=14.1 if captura_lateral or leyenda_informe else 15
            y=text(body,42,y,bodyw,10.3 if captura_lateral else 10.8,INK,False,leading)-(8 if leyenda_informe else 13)
        if has and leyenda_informe:
            with Image.open(imagepath) as captura:
                ancho,alto=captura.size
            # Deja espacio para la leyenda y el pie, sin recortar el informe.
            iw=min(420,(y-98)*ancho/alto)
            ih=iw*alto/ancho
            x=(W-iw)/2
            c.setFillColor(HexColor(LIGHT));c.roundRect(x-6,y-ih-6,iw+12,ih+12,10,fill=1,stroke=0)
            c.drawImage(ImageReader(str(imagepath)),x,y-ih,width=iw,height=ih)
            y=text(leyenda_informe,x,y-ih-18,iw,8,MUTED)
        if y<63:overflows.append((num,round(y,1)))
        c.showPage()
    c.save()
    print(json.dumps({'archivo':str(out),'paginas':total,'desbordamientos':overflows},ensure_ascii=False))
    if overflows:raise RuntimeError('Contenido excede el área útil: '+str(overflows))

if __name__=='__main__':main()
