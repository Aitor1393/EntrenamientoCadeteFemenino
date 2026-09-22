# Desplegar en Cloudflare Pages

La web se sirve desde **Cloudflare Pages**, que además permite decidir quién
entra con **Cloudflare Access**. GitHub Pages no sabe hacer eso: publica en
abierto o no publica.

Aquí importa, porque aunque la web no lleve ningún dato personal de las
jugadoras, sí lleva la planificación completa de la temporada: el plan de un
equipo que compite.

## Ajustes del proyecto

En el panel de Cloudflare: **Workers & Pages → Create → Pages → Connect to
Git**, eliges este repositorio y rellenas:

| Campo | Valor |
|---|---|
| Production branch | `main` |
| Framework preset | None |
| Build command | `bash scripts/preparar-sitio.sh` |
| Build output directory | `_sitio` |
| Root directory | *(vacío)* |

El script deja en `_sitio/` solo la web: `index.html`, `assets/` y `data/`, más
`_headers`. Fuera se quedan `fuentes/`, `scripts/` y `pruebas/`.

## Quién puede entrar

**Zero Trust → Access → Applications → Add an application → Self-hosted**,
apuntando al dominio del proyecto. En las políticas defines quién pasa: una
lista de correos, un dominio entero, o acceso libre.

**Aviso que importa:** las rutas de esta web van con almohadilla
(`#/sesion/M1-16`), y lo que va detrás de `#` no llega nunca al servidor. Así
que **el control de acceso es por sitio entero, no por pantalla**. No se puede
dejar abierto el calendario y cerrar el resto.

## GitHub Pages

Déjalo apagado. Mientras siga activo, la web estaría también en
`aitor1393.github.io/EntrenamientoCadeteFemenino/` sin ninguna identificación,
y Access no serviría de nada.

Por eso la Action de este repositorio (`.github/workflows/validar.yml`) solo
valida: no despliega. El despliegue lo hace Cloudflare al empujar a `main`.

## Comprobar antes de publicar

```bash
python3 scripts/generar.py
bash scripts/preparar-sitio.sh
python3 -m http.server 8777 --directory _sitio
```

Y abrir http://localhost:8777. Eso es exactamente lo que se va a servir.
