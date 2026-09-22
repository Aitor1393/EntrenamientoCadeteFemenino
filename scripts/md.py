#!/usr/bin/env python3
"""Markdown a HTML, lo justo para los documentos de fuentes/.

No es un conversor general: cubre exactamente lo que usan los documentos del
proyecto (encabezados, tablas, listas, citas, negritas, cursivas, código y
separadores). Si aparece una construcción nueva, saldrá como párrafo suelto y
se verá a simple vista en la web, que es preferible a fallar en silencio.

Se escapa SIEMPRE el HTML del original antes de aplicar el formato: los
documentos son texto, no marcado de confianza.
"""
import re

_ESCAPES = [("&", "&amp;"), ("<", "&lt;"), (">", "&gt;"), ('"', "&quot;")]


def escapar(t):
    for a, b in _ESCAPES:
        t = t.replace(a, b)
    return t


def en_linea(t):
    """Negritas, cursivas, código y enlaces dentro de una línea ya escapada."""
    t = re.sub(r"`([^`]+)`", r"<code>\1</code>", t)
    t = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", t)
    # La cursiva no debe comerse los **dobles**, ya consumidos arriba.
    t = re.sub(r"(?<!\*)\*([^*\n]+?)\*(?!\*)", r"<em>\1</em>", t)
    t = re.sub(r"\[([^\]]+)\]\((https?://[^)\s]+)\)",
               r'<a href="\2" rel="noopener" target="_blank">\1</a>', t)
    return t


def _es_separador(linea):
    """La segunda fila de una tabla: |---|:--:|---|"""
    return bool(re.match(r"^\|[\s:|-]+\|$", linea)) and "-" in linea


def _celdas(linea):
    return [c.strip() for c in linea.strip().strip("|").split("|")]


def convertir(texto):
    """Devuelve HTML. Entra markdown crudo del documento."""
    lineas = texto.replace("\r\n", "\n").split("\n")
    salida = []
    i = 0
    n = len(lineas)

    while i < n:
        linea = lineas[i]
        cruda = linea.rstrip()

        # --- bloque de código
        if cruda.startswith("```"):
            i += 1
            cuerpo = []
            while i < n and not lineas[i].startswith("```"):
                cuerpo.append(escapar(lineas[i]))
                i += 1
            i += 1
            salida.append("<pre><code>" + "\n".join(cuerpo) + "</code></pre>")
            continue

        # --- separador
        if re.match(r"^\s*(---|\*\*\*|___)\s*$", cruda):
            salida.append("<hr>")
            i += 1
            continue

        # --- encabezado
        m = re.match(r"^(#{1,6})\s+(.*)$", cruda)
        if m:
            nivel = min(len(m.group(1)) + 1, 6)   # # del documento -> h2 en la página
            salida.append("<h%d>%s</h%d>" % (nivel, en_linea(escapar(m.group(2))), nivel))
            i += 1
            continue

        # --- tabla
        if cruda.startswith("|") and i + 1 < n and _es_separador(lineas[i + 1].rstrip()):
            cabecera = _celdas(cruda)
            i += 2
            filas = []
            while i < n and lineas[i].rstrip().startswith("|"):
                filas.append(_celdas(lineas[i].rstrip()))
                i += 1
            html = ['<div class="desliza"><table class="tabla"><thead><tr>']
            html += ["<th>%s</th>" % en_linea(escapar(c)) for c in cabecera]
            html.append("</tr></thead><tbody>")
            for f in filas:
                html.append("<tr>" + "".join(
                    "<td>%s</td>" % en_linea(escapar(c)) for c in f) + "</tr>")
            html.append("</tbody></table></div>")
            salida.append("".join(html))
            continue

        # --- cita
        if cruda.startswith(">"):
            cuerpo = []
            while i < n and lineas[i].rstrip().startswith(">"):
                cuerpo.append(re.sub(r"^>\s?", "", lineas[i].rstrip()))
                i += 1
            salida.append("<blockquote>" + convertir("\n".join(cuerpo)) + "</blockquote>")
            continue

        # --- listas
        m = re.match(r"^(\s*)([-*+]|\d+\.)\s+(.*)$", cruda)
        if m:
            ordenada = not m.group(2) in ("-", "*", "+")
            etiqueta = "ol" if ordenada else "ul"
            elementos = []
            while i < n:
                mm = re.match(r"^(\s*)([-*+]|\d+\.)\s+(.*)$", lineas[i].rstrip())
                if not mm:
                    # continuación sangrada de la viñeta anterior
                    if elementos and lineas[i].strip() and lineas[i].startswith(("  ", "\t")):
                        elementos[-1] += " " + lineas[i].strip()
                        i += 1
                        continue
                    break
                if (mm.group(2) in ("-", "*", "+")) == ordenada:
                    break
                elementos.append(mm.group(3))
                i += 1
            salida.append("<%s>%s</%s>" % (
                etiqueta,
                "".join("<li>%s</li>" % en_linea(escapar(e)) for e in elementos),
                etiqueta))
            continue

        # --- párrafo
        if not cruda.strip():
            i += 1
            continue
        cuerpo = []
        while i < n and lineas[i].strip() and not re.match(
                r"^\s*(#{1,6}\s|\||>|```|---|\*\*\*|___|[-*+]\s|\d+\.\s)", lineas[i]):
            cuerpo.append(lineas[i].strip())
            i += 1
        if cuerpo:
            salida.append("<p>%s</p>" % en_linea(escapar(" ".join(cuerpo))))
        else:
            i += 1

    return "".join(salida)
