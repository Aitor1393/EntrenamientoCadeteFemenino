#!/usr/bin/env python3
"""
Genera las cuatro fichas de sesión desde una única fuente de datos.

    python build_fichas.py

Lee  datos.json  y  plantilla_pre.html / plantilla_post.html,
y escribe  fichas_sesion_M0.html, _M1.html, _M2.html, _M3_M4.html.

Cada fichero incluye SOLO los diagramas, entradas de banco y detalles que usan
sus propias sesiones, así que ninguno arrastra datos de los demás.

Para cambiar un ejercicio se edita datos.json y se vuelve a ejecutar: el cambio
aparece en los cuatro ficheros a la vez.
"""
import json, re, sys, pathlib

AQUI = pathlib.Path(__file__).parent
DATOS = AQUI / "datos.json"
PRE = AQUI / "plantilla_pre.html"
POST = AQUI / "plantilla_post.html"

# título, subtítulo y fechas de arranque de cada bloque
BLOQUES = {
    "M0": dict(
        fichero="fichas_sesion_M0.html",
        titulo="M0 Pretemporada",
        sub="M0 Pretemporada · 6 sesiones · 15 de septiembre a 2 de octubre · 12 jugadoras, 4 balones.",
    ),
    "M1": dict(
        fichero="fichas_sesion_M1.html",
        titulo="M1 Construcción",
        sub="M1 Construcción · 21 sesiones · 6 de octubre a 18 de diciembre · 12 jugadoras, 4 balones.",
    ),
    "M2": dict(
        fichero="fichas_sesion_M2.html",
        titulo="M2 Densidad",
        sub="M2 Densidad · 18 sesiones · 12 de enero a 12 de marzo · nueve jornadas seguidas sin descanso.",
    ),
    "M3_M4": dict(
        fichero="fichas_sesion_M3_M4.html",
        titulo="Transición B, M3 y M4",
        sub="Transición B, M3 y M4 · 21 sesiones · 16 de marzo a 28 de mayo · las cuatro finales y la 2ª Fase.",
    ),
}

MESES = {"enero":1,"febrero":2,"marzo":3,"abril":4,"mayo":5,"junio":6,"julio":7,
         "agosto":8,"septiembre":9,"octubre":10,"noviembre":11,"diciembre":12}


def fecha_iso(texto, anyo_base=2026):
    """'Martes 6 de octubre' -> '2026-10-06'. Enero a junio se asumen del año siguiente."""
    m = re.search(r"(\d{1,2})\s+de\s+([a-záéíóú]+)", texto.lower())
    if not m:
        return None
    dia, mes = int(m.group(1)), MESES.get(m.group(2))
    if not mes:
        return None
    anyo = anyo_base if mes >= 9 else anyo_base + 1
    return "%04d-%02d-%02d" % (anyo, mes, dia)


def js(obj):
    return json.dumps(obj, ensure_ascii=False, indent=1)


def usados_en(sesiones):
    cods = []
    for s in sesiones:
        for b in s["b"]:
            if b[2] not in cods:
                cods.append(b[2])
    return cods


def main():
    datos = json.loads(DATOS.read_text(encoding="utf-8"))
    pre = PRE.read_text(encoding="utf-8")
    post = POST.read_text(encoding="utf-8")
    errores = []

    for clave, cfg in BLOQUES.items():
        ses = datos["S"][clave]
        cods = usados_en(ses)

        D = {c: datos["D"][c] for c in cods if c in datos["D"]}
        E = {c: datos["E"][c] for c in cods if c in datos["E"]}
        DET = {c: datos["DET"][c] for c in cods if c in datos["DET"]}

        # comprobaciones
        for c in cods:
            if c not in datos["E"]:
                errores.append("%s: código %s sin entrada en E" % (clave, c))
            if re.match(r"^F\d+-N\d+$", c):
                if c not in datos["D"]:
                    errores.append("%s: %s sin pizarra" % (clave, c))
                if c not in datos["DET"]:
                    errores.append("%s: %s sin detalle" % (clave, c))
        for s in ses:
            b = s["b"]
            if b[0][0] != 0 or b[-1][1] != s["d"]:
                errores.append("%s S%s: no cubre de 0 a %s" % (clave, s["n"], s["d"]))
            for i in range(len(b) - 1):
                if b[i][1] != b[i + 1][0]:
                    errores.append("%s S%s: hueco en el minuto %s" % (clave, s["n"], b[i][1]))

        fechas = [fecha_iso(s["f"]) for s in ses]
        if None in fechas:
            errores.append("%s: alguna fecha no se ha podido interpretar" % clave)

        bloque_datos = (
            "/* ===== DIAGRAMAS ===== */\nvar D = %s;\n\n"
            "/* ===== DETALLE ===== */\nvar DET = %s;\n\n"
            "/* ===== BANCO ===== */\nvar E = %s;\n\n"
            "/* ===== SESIONES ===== */\nvar S = %s;\n\n"
        ) % (js(D), js(DET), js(E), js(ses))

        html = pre + bloque_datos + post
        html = re.sub(r"<title>.*?</title>",
                      "<title>Fichas de sesión · %s</title>" % cfg["titulo"], html, flags=re.S)
        html = re.sub(r"<p>M0 Pretemporada.*?</p>", "<p>%s</p>" % cfg["sub"], html, flags=re.S)
        html = re.sub(r"var F=\[.*?\];",
                      "var F=%s;" % json.dumps(fechas), html, flags=re.S)

        (AQUI / cfg["fichero"]).write_text(html, encoding="utf-8")
        print("%-24s %2d sesiones · %2d pizarras · %2d detalles · %d KB"
              % (cfg["fichero"], len(ses), len(D), len(DET), len(html) // 1024))

    if errores:
        print("\nERRORES:")
        for e in errores:
            print("  ·", e)
        sys.exit(1)
    print("\nSin errores.")


if __name__ == "__main__":
    main()
