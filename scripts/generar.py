#!/usr/bin/env python3
"""Convierte fuentes/ en data/. La web no lee los documentos: lee lo generado.

    python3 scripts/generar.py

Entra:
  fuentes/herramientas/datos.json   diagramas, banco, detalles y sesiones
  fuentes/CLAUDE.md                 familias, calendario, restricciones, modelo
  fuentes/docs/*.md                 la planificación bloque a bloque
  fuentes/revisiones/*.md           contraste con el curso FBM Nivel I

Sale:
  data/temporada.json   meta, bloques, restricciones, modelo, competición
  data/familias.json    las 19 familias con sus niveles
  data/ejercicios.json  banco + detalle + diagramas
  data/sesiones.json    las 66 sesiones, con fecha ISO y semana
  data/documentos.json  los documentos convertidos a HTML

El generador SALE EN ROJO si una fuente cambia de forma: es preferible a
publicar media temporada en silencio. Cada comprobación dice qué esperaba.
"""
import json
import pathlib
import re
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))
import md  # noqa: E402

RAIZ = pathlib.Path(__file__).resolve().parent.parent
FUENTES = RAIZ / "fuentes"
DATA = RAIZ / "data"

MESES = {"enero": 1, "febrero": 2, "marzo": 3, "abril": 4, "mayo": 5, "junio": 6,
         "julio": 7, "agosto": 8, "septiembre": 9, "octubre": 10,
         "noviembre": 11, "diciembre": 12}
MESES_CORTOS = {"ene": 1, "feb": 2, "mar": 3, "abr": 4, "may": 5, "jun": 6,
                "jul": 7, "ago": 8, "sep": 9, "oct": 10, "nov": 11, "dic": 12}

# Los cuatro ficheros de fichas agrupan así los bloques de la temporada.
BLOQUES = [
    {"id": "M0", "nombre": "M0 · Pretemporada", "corto": "M0",
     "descripcion": "Las seis sesiones que quedan antes de la primera jornada."},
    {"id": "M1", "nombre": "M1 · Construcción", "corto": "M1",
     "descripcion": "Nueve jornadas y tres viernes sin partido: las únicas sesiones "
                    "largas del trimestre que pueden cargar de verdad."},
    {"id": "M2", "nombre": "M2 · Densidad", "corto": "M2",
     "descripcion": "Nueve jornadas seguidas sin un solo viernes libre. Aquí el riesgo "
                    "no es sobreentrenar, es desadaptarse."},
    {"id": "M3_M4", "nombre": "Transición B, M3 y M4", "corto": "M3/M4",
     "descripcion": "De Semana Santa al final: las cuatro jornadas que deciden la "
                    "temporada y los tres escenarios de la segunda fase."},
]

# Los tipos de bloque del banco, con el color que ya usaban las fichas.
TIPOS = {
    "prev": {"nombre": "Preventivo", "color": "#6E8C6B"},
    "tec": {"nombre": "Técnica", "color": "#1D3B54"},
    "fis": {"nombre": "Físico", "color": "#BE5A21"},
    "jue": {"nombre": "Juego", "color": "#4A6E86"},
    "org": {"nombre": "Organización", "color": "#C3B79F"},
}

DOCUMENTOS = [
    ("plan", "docs/00_planificacion_temporada.md", "Planificación de temporada",
     "El documento maestro: modelo, objetivos, macrociclos, control de carga y protocolos."),
    ("banco", "docs/01_banco_ejercicios.md", "Banco de ejercicios",
     "Las familias con sus niveles y las referencias al material propio."),
    ("m0", "docs/02_M0_pretemporada.md", "M0 · Pretemporada",
     "Las seis sesiones del 15 de septiembre al 2 de octubre."),
    ("m1", "docs/03_M1_construccion.md", "M1 · Construcción",
     "21 sesiones y 9 jornadas, del 6 de octubre al 18 de diciembre."),
    ("m2", "docs/04_M2_transicion_A_densidad.md", "Transición A y M2 · Densidad",
     "Navidad y las 18 sesiones del 12 de enero al 12 de marzo."),
    ("m3m4", "docs/05_M3_M4_pico_segunda_fase.md", "Transición B, M3 y M4",
     "Semana Santa, abril y los tres escenarios de mayo."),
    ("competitiva", "docs/06_capa_competitiva.md", "Capa competitiva",
     "Cómo meter marcador en los ejercicios sin desvirtuarlos."),
    ("sistema", "docs/07_sistema_y_mapa_fuentes.md", "Sistema y mapa de fuentes",
     "Cómo se reorganizaron las familias y dónde está cada cosa en los libros."),
    ("revision1", "revisiones/revision_curso_N1_parte1.md",
     "Revisión del curso · parte 1",
     "Contraste de la planificación con el material del curso FBM Nivel I."),
    ("revision2", "revisiones/revision_curso_N1_parte2.md",
     "Revisión del curso · parte 2",
     "Segunda parte del contraste con el material del curso."),
]

errores = []
avisos = []


def exigir(condicion, mensaje):
    if not condicion:
        errores.append(mensaje)
    return condicion


def leer(rel):
    p = FUENTES / rel
    if not p.exists():
        errores.append("falta la fuente %s" % rel)
        return ""
    return p.read_text(encoding="utf-8")


# --------------------------------------------------------------------- fechas

def fecha_iso(texto, anyo_base=2026):
    """«Martes 6 de octubre» -> «2026-10-06». De enero a junio es el año siguiente."""
    m = re.search(r"(\d{1,2})\s+de\s+([a-záéíóúñ]+)", texto.lower())
    if not m:
        return None
    mes = MESES.get(m.group(2))
    if not mes:
        return None
    anyo = anyo_base if mes >= 9 else anyo_base + 1
    return "%04d-%02d-%02d" % (anyo, mes, int(m.group(1)))


def fecha_corta_iso(texto, anyo_base=2026):
    """«6 oct» -> «2026-10-06». Para las tablas de calendario de los documentos."""
    m = re.search(r"(\d{1,2})\s*([a-z]{3})", texto.lower())
    if not m:
        return None
    mes = MESES_CORTOS.get(m.group(2))
    if not mes:
        return None
    anyo = anyo_base if mes >= 9 else anyo_base + 1
    return "%04d-%02d-%02d" % (anyo, mes, int(m.group(1)))


def dia_semana(iso):
    """0 = lunes. Sin dependencias: Zeller sobre la fecha ISO."""
    import datetime
    a, m, d = (int(x) for x in iso.split("-"))
    return datetime.date(a, m, d).weekday()


def sumar_dias(iso, n):
    import datetime
    a, m, d = (int(x) for x in iso.split("-"))
    return (datetime.date(a, m, d) + datetime.timedelta(days=n)).isoformat()


def lunes_de(iso):
    return sumar_dias(iso, -dia_semana(iso))


# ------------------------------------------------------------- tablas markdown

def tablas(texto):
    """Todas las tablas del documento como (cabecera, filas)."""
    salida = []
    lineas = texto.split("\n")
    i = 0
    while i < len(lineas):
        if (lineas[i].strip().startswith("|") and i + 1 < len(lineas)
                and re.match(r"^\|[\s:|-]+\|$", lineas[i + 1].strip())
                and "-" in lineas[i + 1]):
            cab = [c.strip() for c in lineas[i].strip().strip("|").split("|")]
            i += 2
            filas = []
            while i < len(lineas) and lineas[i].strip().startswith("|"):
                filas.append([c.strip() for c in lineas[i].strip().strip("|").split("|")])
                i += 1
            salida.append((cab, filas))
            continue
        i += 1
    return salida


def limpio(celda):
    """Quita el marcado de una celda: **negrita**, *cursiva*, ~~tachado~~, `código`."""
    t = re.sub(r"~~(.+?)~~", r"\1", celda)
    t = re.sub(r"\*\*(.+?)\*\*", r"\1", t)
    t = re.sub(r"\*(.+?)\*", r"\1", t)
    t = re.sub(r"`(.+?)`", r"\1", t)
    return t.strip()


def seccion(texto, titulo):
    """El cuerpo de la sección que empieza por ese encabezado, hasta el siguiente
    del mismo nivel o superior."""
    m = re.search(r"^(#{1,6})\s*%s\s*$" % re.escape(titulo), texto, re.M)
    if not m:
        return None
    nivel = len(m.group(1))
    resto = texto[m.end():]
    fin = re.search(r"^#{1,%d}\s" % nivel, resto, re.M)
    return (resto[:fin.start()] if fin else resto).strip()


# --------------------------------------------------------------- las familias

GRUPOS = [
    ("A", "Técnica y táctica individual", "### A · Técnica y táctica individual"),
    ("B", "Defensa", "### B · Defensa"),
    ("C", "Contraataque", "### C · Contraataque"),
    ("D", "Transversal", "### D · Transversal"),
]


def familias_de_claude(texto):
    """Las 19 familias, con su grupo, de las cuatro tablas de CLAUDE.md."""
    fams = {}
    for clave, nombre, encabezado in GRUPOS:
        cuerpo = seccion(texto, encabezado.lstrip("# ").strip())
        if cuerpo is None:
            errores.append("CLAUDE.md: no encuentro la sección «%s»" % encabezado)
            continue
        tabs = tablas(cuerpo)
        if not tabs:
            errores.append("CLAUDE.md: la sección «%s» ya no tiene tabla" % encabezado)
            continue
        for fila in tabs[0][1]:
            cod = limpio(fila[0])
            if not re.match(r"^F\d+$", cod):
                continue
            entrada = limpio(fila[1])
            # «Zona 2-3, por miniaturas (N1-N7)» -> nombre + apostilla
            fams[cod] = {
                "codigo": cod,
                "grupo": clave,
                "grupo_nombre": nombre,
                "nombre": re.sub(r"\s*\(.*?\)\s*$", "", entrada).strip(),
                "apostilla": (re.search(r"\((.*?)\)\s*$", entrada).group(1)
                              if re.search(r"\((.*?)\)\s*$", entrada) else ""),
                "niveles": [],
                "nota": "",
            }
    return fams


RE_NIVEL = re.compile(r"^\*\*(N\d+)\s*·\s*(.+?)\*\*\s*(?:—\s*(\d+)\s*min)?\s*(.*)$")
RE_CAMPO = re.compile(r"^\*([^*:]+):\*\s*(.*)$")


def niveles_del_banco(texto):
    """Lee docs/01_banco_ejercicios.md: por cada familia, sus niveles con
    descripción, clave, marcador y referencia a los libros.

    No todas las familias están escritas en niveles. F16 y F17 llevan su
    contenido en tablas, así que además se guarda la sección entera en HTML y
    la vista usa lo que haya."""
    porfam = {}
    familia = None
    nivel = None
    esperando_nota = False

    for linea in texto.split("\n"):
        cruda = linea.rstrip()

        m = re.match(r"^##\s+(F\d+)\s*·\s*(.+?)\s*$", cruda)
        if m:
            familia = m.group(1)
            porfam[familia] = {"nota": "", "niveles": [], "crudo": []}
            nivel = None
            esperando_nota = True
            continue

        if familia is None:
            continue

        # Un encabezado de nivel 1 cierra el recorrido de familias: lo que sigue
        # es el apéndice, que no pertenece a ninguna.
        if re.match(r"^#\s+", cruda):
            familia = None
            nivel = None
            continue

        porfam[familia]["crudo"].append(cruda)

        # La cursiva suelta bajo el título de la familia es su nota de contexto.
        if esperando_nota and cruda.startswith("*") and not cruda.startswith("**"):
            porfam[familia]["nota"] = limpio(cruda)
            esperando_nota = False
            continue
        if cruda.strip():
            esperando_nota = False

        m = RE_NIVEL.match(cruda)
        if m:
            nivel = {
                "nivel": m.group(1),
                "nombre": m.group(2).strip(),
                "minutos": int(m.group(3)) if m.group(3) else None,
                "formato": limpio(m.group(4)) if m.group(4) else "",
                "descripcion": "",
                "campos": [],
                "crudo": [],
            }
            porfam[familia]["niveles"].append(nivel)
            continue

        if nivel is None:
            continue

        m = RE_CAMPO.match(cruda)
        if m:
            nivel["campos"].append({"etiqueta": m.group(1).strip(),
                                    "texto": limpio(m.group(2))})
            continue

        if cruda.strip() and not cruda.startswith("#") and not cruda.startswith("---"):
            nivel["crudo"].append(cruda)
            nivel["descripcion"] = (nivel["descripcion"] + " " + limpio(cruda)).strip()

    for info in porfam.values():
        info["html"] = md.convertir("\n".join(info.pop("crudo")).strip())
        for n in info["niveles"]:
            # `descripcion` se queda para buscar en texto plano; `html` es lo que
            # se pinta, y conserva las listas numeradas que el nivel traiga.
            n["html"] = md.convertir("\n".join(n.pop("crudo")).strip())
    return porfam


# ------------------------------------------------------------- el calendario

RE_JORNADA = re.compile(r"J\s*(\d+)")


def jornadas_de_documentos():
    """Las jornadas por semana, de las tablas «| Sem |» y «| MC |» de los
    documentos de bloque. Devuelve {iso del viernes: {jornada, sabado}}."""
    porviernes = {}
    for rel, anyo in (("docs/03_M1_construccion.md", 2026),
                      ("docs/04_M2_transicion_A_densidad.md", 2027),
                      ("docs/05_M3_M4_pico_segunda_fase.md", 2027)):
        texto = leer(rel)
        encontrada = False
        for cab, filas in tablas(texto):
            if not cab or cab[0] not in ("Sem", "MC"):
                continue
            if "Martes" not in cab or "Viernes" not in cab:
                continue
            encontrada = True
            i_vie = cab.index("Viernes")
            for fila in filas:
                if len(fila) <= i_vie:
                    continue
                base = anyo if anyo == 2026 else 2026
                viernes = fecha_corta_iso(limpio(fila[i_vie]), base)
                if not viernes:
                    continue
                resto = " ".join(limpio(c) for c in fila[i_vie + 1:])
                m = RE_JORNADA.search(resto)
                porviernes[viernes] = {
                    "jornada": int(m.group(1)) if m else None,
                    "libre": "Libre" in resto or not m,
                }
        if not encontrada:
            errores.append("%s: ya no tiene tabla de calendario con Sem/MC, "
                           "Martes y Viernes" % rel)
    return porviernes


# ------------------------------------------------------------------- programa

def main():
    datos = json.loads(leer("herramientas/datos.json") or "{}")
    for clave in ("D", "E", "DET", "S"):
        exigir(clave in datos, "herramientas/datos.json: falta la clave «%s»" % clave)
    if errores:
        salir()

    claude = leer("CLAUDE.md")
    banco = leer("docs/01_banco_ejercicios.md")

    # ---------------------------------------------------------------- familias
    fams = familias_de_claude(claude)
    exigir(len(fams) >= 19,
           "CLAUDE.md: esperaba al menos 19 familias y he leído %d" % len(fams))

    porfam = niveles_del_banco(banco)
    for cod, info in porfam.items():
        if cod in fams:
            fams[cod]["niveles"] = info["niveles"]
            fams[cod]["nota"] = info["nota"]
            fams[cod]["html"] = info["html"]
    for f in fams.values():
        f.setdefault("html", "")

    # F16 y F17 están escritas en tablas, no en niveles, y F18 no tiene sección
    # propia: su contenido vive en el documento de M2. Es así en el original, no
    # un fallo de lectura, pero conviene verlo al generar.
    sin_nada = [c for c, f in fams.items() if not f["niveles"] and not f["html"]]
    if sin_nada:
        avisos.append("familias sin niveles ni texto en el banco: "
                      + ", ".join(sorted(sin_nada, key=lambda c: int(c[1:]))))
    descritos = {}
    for cod, f in fams.items():
        descritos[cod] = {n["nivel"] for n in f["niveles"]}

    solo_texto = [c for c, f in fams.items() if not f["niveles"] and f["html"]]
    if solo_texto:
        avisos.append("familias descritas en tablas y no en niveles: "
                      + ", ".join(sorted(solo_texto, key=lambda c: int(c[1:]))))

    # -------------------------------------------------------------- sesiones
    jornadas = jornadas_de_documentos()
    sesiones = []
    for bloque in BLOQUES:
        lista = datos["S"].get(bloque["id"])
        if not exigir(lista, "datos.json: no hay sesiones del bloque %s" % bloque["id"]):
            continue
        for s in lista:
            iso = fecha_iso(s["f"])
            if not exigir(iso, "%s S%s: no entiendo la fecha «%s»"
                               % (bloque["id"], s["n"], s["f"])):
                continue
            bloques = []
            for b in s["b"]:
                bloques.append({
                    "desde": b[0], "hasta": b[1], "codigo": b[2],
                    "sinCanasta": len(b) > 3 and b[3] == "sc",
                })
            # Continuidad: la misma comprobación que hace build_fichas.py.
            exigir(bloques[0]["desde"] == 0 and bloques[-1]["hasta"] == s["d"],
                   "%s S%s: los bloques no cubren de 0 a %s"
                   % (bloque["id"], s["n"], s["d"]))
            for i in range(len(bloques) - 1):
                exigir(bloques[i]["hasta"] == bloques[i + 1]["desde"],
                       "%s S%s: hueco en el minuto %s"
                       % (bloque["id"], s["n"], bloques[i]["hasta"]))

            viernes = sumar_dias(lunes_de(iso), 4)
            jor = jornadas.get(viernes, {})
            sesiones.append({
                "id": "%s-%d" % (bloque["id"], s["n"]),
                "bloque": bloque["id"],
                "numero": s["n"],
                "fecha": iso,
                "fechaTexto": s["f"],
                "duracion": s["d"],
                "carga": s["c"],
                "tema": s["tema"],
                "lunes": lunes_de(iso),
                "jornada": jor.get("jornada"),
                "sinPartido": bool(jor) and jor.get("jornada") is None,
                "bloques": bloques,
            })

    sesiones.sort(key=lambda s: (s["fecha"], s["id"]))
    exigir(len(sesiones) == 66,
           "esperaba 66 sesiones con ficha y he montado %d" % len(sesiones))

    vistas = sorted({s["jornada"] for s in sesiones if s["jornada"]})
    faltan = [j for j in range(1, max(vistas) + 1) if j not in vistas] if vistas else []
    if faltan:
        avisos.append("jornadas que no aparecen en ninguna tabla de los documentos: "
                      + ", ".join("J%d" % j for j in faltan))

    # ------------------------------------------------------------- ejercicios
    usados = []
    for s in sesiones:
        for b in s["bloques"]:
            if b["codigo"] not in usados:
                usados.append(b["codigo"])

    ejercicios = {}
    sin_describir = []
    for cod in usados:
        e = datos["E"].get(cod)
        if not exigir(e, "el código %s aparece en una sesión y no está en el banco" % cod):
            continue
        familia = cod.split("-")[0] if re.match(r"^F\d+-N\d+$", cod) else None
        ejercicios[cod] = {
            "codigo": cod,
            "nombre": e.get("n", cod),
            "tipo": e.get("t", "org"),
            "organizacion": e.get("m", ""),
            "clave": e.get("c", ""),
            "defensa": e.get("d", ""),
            "marcador": e.get("x", ""),
            "cita": cita(e.get("l", "")),
            "familia": familia,
            "nivel": cod.split("-")[1] if familia else None,
            "diagrama": datos["D"].get(cod),
            "detalle": datos["DET"].get(cod),
        }
        if familia:
            exigir(cod in datos["D"], "%s no tiene pizarra" % cod)
            exigir(cod in datos["DET"], "%s no tiene detalle «cómo se monta»" % cod)
            exigir(familia in fams,
                   "%s pertenece a la familia %s, que no existe en CLAUDE.md"
                   % (cod, familia))
            # Un nivel puede usarse en una sesión, con su pizarra y su montaje,
            # sin estar descrito en el banco: pasa con F9-N6 y F9-N7. No es un
            # error del generador, es un hueco de la fuente, y conviene verlo.
            if familia in fams and ejercicios[cod]["nivel"] not in descritos.get(familia, set()):
                sin_describir.append(cod)

    if sin_describir:
        avisos.append("niveles que se usan en sesiones y el banco no describe: "
                      + ", ".join(sin_describir))

    # ------------------------------------------------------------- documentos
    documentos = []
    for ident, rel, titulo, resumen in DOCUMENTOS:
        crudo = leer(rel)
        if not crudo:
            continue
        documentos.append({
            "id": ident, "titulo": titulo, "resumen": resumen,
            "origen": rel, "html": md.convertir(crudo),
        })

    # --------------------------------------------------------------- temporada
    temporada = {
        "meta": {
            "equipo": "Cadete Femenino Preferente · Serie B",
            "temporada": "2026/2027",
            "competicion": "Campeonato de Madrid Cadete Femenino Preferente, Serie B",
            "jugadoras": 12,
            "balones": 4,
            "sesiones": len(sesiones),
            "familias": len(fams),
            "ejercicios": len(ejercicios),
            "inicio": sesiones[0]["fecha"] if sesiones else "",
            "fin": sesiones[-1]["fecha"] if sesiones else "",
        },
        "bloques": BLOQUES,
        "tipos": TIPOS,
        "secciones": secciones_de_claude(claude),
    }

    if errores:
        salir()

    DATA.mkdir(exist_ok=True)
    escribir("temporada.json", temporada)
    escribir("familias.json", [fams[c] for c in orden_familias(fams)])
    escribir("ejercicios.json", ejercicios)
    escribir("sesiones.json", sesiones)
    escribir("documentos.json", documentos)

    print("%d sesiones · %d familias · %d ejercicios · %d documentos"
          % (len(sesiones), len(fams), len(ejercicios), len(documentos)))
    con_pizarra = sum(1 for e in ejercicios.values() if e["diagrama"])
    con_detalle = sum(1 for e in ejercicios.values() if e["detalle"])
    print("%d con pizarra · %d con «cómo se monta»" % (con_pizarra, con_detalle))
    for a in avisos:
        print("  aviso ·", a)
    print("Sin errores.")


def orden_familias(fams):
    """F1…F19 por número, no alfabético: si no, F10 va antes que F2."""
    return sorted(fams, key=lambda c: int(c[1:]))


def cita(enlace):
    """El campo `l` del banco era una ruta a PDF. En la web se queda en texto:
    los libros son del entrenador y no se publican."""
    if not enlace:
        return ""
    pagina = (re.search(r"#page=(\d+)", enlace) or [None, None])[1]
    nombre = "500 Ejercicios"
    if enlace.startswith("40Ejercicios"):
        nombre = "40 Defensa"
    elif enlace.startswith("75Ejercicios"):
        nombre = "75 Desmarque"
    elif enlace.startswith("25Calentamientos"):
        nombre = "25 Calentamientos"
    return nombre + (", p. " + pagina if pagina else "")


def secciones_de_claude(texto):
    """Las partes de CLAUDE.md que el entrenador consulta en la web."""
    quiero = [
        ("restricciones", "Restricciones duras"),
        ("prioridades", "Las prioridades del entrenador"),
        ("modelo", "Modelo de juego"),
        ("competicion", "Competición"),
        ("decisiones", "Decisiones tomadas y por qué"),
        ("avisos", "Avisos honestos que hay que mantener"),
    ]
    salida = []
    for ident, titulo in quiero:
        cuerpo = seccion(texto, titulo)
        if cuerpo is None:
            errores.append("CLAUDE.md: no encuentro la sección «%s»" % titulo)
            continue
        salida.append({"id": ident, "titulo": titulo, "html": md.convertir(cuerpo)})
    return salida


def escribir(nombre, obj):
    (DATA / nombre).write_text(
        json.dumps(obj, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


def salir():
    print("ERRORES:", file=sys.stderr)
    for e in errores:
        print("  ·", e, file=sys.stderr)
    sys.exit(1)


if __name__ == "__main__":
    main()
