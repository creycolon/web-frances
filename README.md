# Édito A1 · 2ᵉ édition — Web interactiva (uso personal)

Sustituye los dos libros en PDF por una web donde cada **pictograma de audio** de cada
página es clicable y reproduce la pista correspondiente.

## Estado

| Libro | Páginas | Pistas de audio | Audio integrado |
|---|---|---|---|
| **Livre** | 193 | 162 (161 actividades + 1 intro/créditos) | ✅ |
| **Cahier** | 145 | 111 actividades (+1 intro no clicable) | ✅ |

> Nota: ambos libros incluyen una pista de *introducción/créditos* al inicio
> (`01_Edito_A1_Livre.mp3` y `piste_000.mp3`). En el Livre es clicable desde el
> pictograma de la esquina de la p. 11; en el Cahier no tiene pictograma asociado.

## Cómo usarlo

```bash
./start.sh        # sirve en http://localhost:8080 (usa Node, con búsqueda en el audio)
# o bien:
node serve.js     # equivalente a ./start.sh
# o bien (sin búsqueda/seek en el audio):
python3 -m http.server 8080
```

Abre `http://localhost:8080` y cambia de libro con las pestañas **Livre / Cahier**
de la barra superior.

> ⚠️ No abras `index.html` con doble clic (`file://`): el navegador bloquea la carga
> de los JSON por CORS. Usa el servidor local.

## Dónde están los audios

- Livre → `audio/livre/` (`01_Edito_A1_Livre.mp3` … `162_...mp3`).
- Cahier → `audio/cahier/` (`piste_001.mp3` … `piste_111.mp3`; `piste_000.mp3` es la intro).

El mapeo exacto pista → archivo está en `data/livre_audio_files.json` y
`data/cahier_audio_files.json`. Sin ese archivo, el visor intenta nombres
normalizados (`001.mp3`, `01.mp3`, `1.mp3`, `.m4a`, `.wav`…).

## Controles

| Acción | Cómo |
|---|---|
| Página siguiente / anterior | Botones `‹` `›` o flechas `←` `→` |
| Reproducir una pista | Clic sobre el pictograma 🎧 de la página |
| Acercar / alejar | Botones `+` / `−` (o `⤢` para ajustar) |
| Ver los pictogramas | Botón 🎧 de la barra superior (resalta las zonas) |
| Pausar / reanudar | Barra inferior o barra espaciadora |
| Ver transcripción | Botón 💬 de la barra del reproductor |

## Estructura

```
index.html               visor
css/style.css            estilos
js/app.js                lógica (soporta Livre y Cahier)
data/livre_audio.json    Livre: pista → página + posición del pictograma + transcripción
data/livre_toc.json      Livre: unidades → rango de páginas
data/livre_audio_files.json  Livre: pista → nombre de archivo
data/cahier_audio.json   Cahier: ídem
data/cahier_toc.json     Cahier: ídem
data/cahier_audio_files.json  Cahier: pista → nombre de archivo
assets/pages/livre/      páginas del Livre (page-001.webp … page-193.webp)
assets/pages/cahier/     páginas del Cahier (page-001.webp … page-145.webp)
audio/livre/             audios del Livre
audio/cahier/            audios del Cahier
```

## Cómo se generó (por si quieres reproducirlo)

1. **Transcripciones** → parseadas desde la sección *Transcripciones · Documents audios*
   (Livre p. 172; Cahier p. 127) a JSON.
2. **Pictogramas** → detectados automáticamente por su firma visual (icono circular de
   auriculares) y convertidos a coordenadas relativas de la página.
3. **Páginas** → renderizadas a 150 DPI con PyMuPDF y convertidas a WebP (q82).
4. **Audios** → mapeados por número de pista. El Cahier usa nombres 0-based
   (`piste_000` = intro; la pista N va en `piste_N.mp3`), verificado por reconocimiento
   de voz sobre las primeras/últimas pistas.
