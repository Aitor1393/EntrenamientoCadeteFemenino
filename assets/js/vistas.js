/* Genera HTML. No toca datos ni decide nada: pregunta a D y pinta.
   Cuelga de window.V y necesita U, D y PZ. */
(function () {
  'use strict';

  var e = U.esc;

  function etiquetaCarga(c) {
    var clase = { alta: 'eti--alarma', media: 'eti--aviso', baja: 'eti--bien' }[c] || 'eti--gris';
    return '<span class="eti ' + clase + '">Carga ' + e(c) + '</span>';
  }

  function etiquetaDia(sesion) {
    var dia = U.diaSemana(sesion.fecha);
    return '<span class="eti eti--gris">' + (dia === 'martes' ? 'Martes' : 'Viernes') +
      ' · ' + sesion.duracion + ' min</span>';
  }

  /* MD-4, MD-1… o el aviso de que ese viernes no tiene partido detrás, que es
     lo que cambia qué puede llevar la sesión. */
  function etiquetaMd(sesion) {
    var md = D.md(sesion);
    if (md !== null) {
      return '<span class="eti">MD' + md + (md === -1 ? ' · víspera' : '') + '</span>';
    }
    return D.viernesQueCarga(sesion)
      ? '<span class="eti eti--bien">Viernes sin partido · puede cargar</span>' : '';
  }

  function etiquetaJornada(sesion) {
    if (!sesion.jornada) return '';
    return '<span class="eti">J' + sesion.jornada + ' · sáb ' +
      e(U.fechaCorta(U.sumarDias(sesion.lunes, 5))) + '</span>';
  }

  function enlaceSesion(s, clase) {
    return '<a class="' + (clase || 'enlace-tarjeta') + '" href="#/sesion/' + e(s.id) + '">' +
      '<div class="enlace-tarjeta__titulo">' + e(s.tema) + '</div>' +
      '<div class="enlace-tarjeta__pie">' + e(U.fechaLarga(s.fecha)) + ' · ' +
      s.duracion + ' min · carga ' + e(s.carga) +
      (s.jornada ? ' · J' + s.jornada : '') + '</div></a>';
  }

  /* La barra de reparto por tipo de bloque. Es la lectura rápida de una sesión:
     cuánto preventivo, cuánta técnica, cuánto juego. */
  function barraReparto(sesion) {
    var reparto = D.repartoDe(sesion);
    var trozos = Object.keys(reparto).map(function (t) {
      var tipo = D.tipo(t);
      var pct = reparto[t] / sesion.duracion * 100;
      return '<i style="width:' + pct.toFixed(2) + '%;background:' + tipo.color + '" ' +
        'title="' + e(tipo.nombre) + ': ' + reparto[t] + ' min"></i>';
    }).join('');
    return '<div class="reparto" aria-hidden="true">' + trozos + '</div>';
  }

  var V = {};

  /* ------------------------------------------------------------------ hoy */

  V.hoy = function (estado) {
    var h = '';
    var dia = U.DIAS_LARGOS[U.aFecha(estado.fecha).getDay()];

    h += '<div class="hoy__cabecera">' +
      '<div class="hoy__dia">' + e(dia) + ' ' + e(U.fechaCorta(estado.fecha)) + '</div>';

    if (estado.estado === 'sesion') {
      var s = estado.sesion;
      h += '<h1 class="hoy__titulo">' + e(s.tema) + '</h1></div>';
      h += '<div class="etis">' + etiquetaDia(s) + etiquetaCarga(s.carga) +
        etiquetaMd(s) + etiquetaJornada(s) + '</div>';
      h += '<p><a class="btn btn--principal btn--ancho" href="#/sesion/' + e(s.id) +
        '">Abrir la ficha de pista</a></p>';
      h += V.resumenSesion(s);
      return h;
    }

    if (estado.estado === 'partido') {
      h += '<h1 class="hoy__titulo">Partido · J' + estado.semana.jornada + '</h1></div>';
      h += '<div class="caja caja--acento"><p>Hoy se juega. La sesión del viernes ya ' +
        'era la víspera: nada nuevo y nada de carga.</p></div>';
      h += '<p><a class="btn btn--principal btn--ancho" href="#/rotaciones">' +
        'Abrir las rotaciones</a></p>';
      return h + V.proximaTarjeta(D.proximaSesion(estado.fecha));
    }

    if (estado.estado === 'sinPartido') {
      h += '<h1 class="hoy__titulo">Sábado sin partido</h1></div>';
      return h + V.proximaTarjeta(D.proximaSesion(estado.fecha));
    }

    if (estado.estado === 'fuera') {
      h += '<h1 class="hoy__titulo">Fuera de temporada</h1></div>';
      h += '<p class="silencio">La temporada va del ' + e(U.fechaLarga(D.temporada.meta.inicio)) +
        ' al ' + e(U.fechaLarga(D.temporada.meta.fin)) + '.</p>';
      return h + V.proximaTarjeta(estado.proxima);
    }

    h += '<h1 class="hoy__titulo">Hoy no se entrena</h1></div>';
    if (estado.semana && estado.semana.jornada) {
      h += '<div class="etis"><span class="eti">Esta semana J' + estado.semana.jornada +
        ' · sáb ' + e(U.fechaCorta(estado.semana.sabado)) + '</span></div>';
    }
    return h + V.proximaTarjeta(estado.proxima);
  };

  V.proximaTarjeta = function (s) {
    if (!s) return '<p class="silencio">No queda ninguna sesión por delante.</p>';
    var dias = U.diasEntre(U.hoyIso(), s.fecha);
    var cuando = dias === 1 ? 'Mañana' : (dias > 0 ? 'Dentro de ' + U.plural(dias, 'día', 'días') : '');
    return '<h2>Lo siguiente</h2>' +
      (cuando ? '<p class="silencio">' + e(cuando) + '</p>' : '') +
      enlaceSesion(s);
  };

  /* Las tres o cuatro cosas de una sesión que se miran antes de entrar. */
  V.resumenSesion = function (s) {
    var sinCanasta = D.minutosSinCanasta(s);
    var familias = {};
    s.bloques.forEach(function (b) {
      var ej = D.ejercicio(b.codigo);
      if (ej && ej.familia) familias[ej.familia] = (familias[ej.familia] || 0) + (b.hasta - b.desde);
    });
    var lista = Object.keys(familias).sort(function (a, b) { return familias[b] - familias[a]; });

    var h = '<h2>De un vistazo</h2>';
    h += '<div class="cifras">' +
      cifra(s.duracion + ' min', 'Duración') +
      cifra(s.bloques.length, 'Bloques') +
      (sinCanasta ? cifra(sinCanasta + ' min', 'Sin canasta') : '') +
      '</div>';
    if (lista.length) {
      h += '<div class="etis">' + lista.map(function (c) {
        var f = D.familia(c);
        return '<a class="eti eti--gris" href="#/familia/' + e(c) + '">' + e(c) + ' · ' +
          e(f ? f.nombre : '') + ' · ' + familias[c] + '′</a>';
      }).join('') + '</div>';
    }
    return h;
  };

  function cifra(valor, etiqueta) {
    return '<div class="cifra"><div class="cifra__valor">' + e(valor) + '</div>' +
      '<div class="cifra__etiqueta">' + e(etiqueta) + '</div></div>';
  }

  /* ----------------------------------------------------------- calendario */

  V.calendario = function () {
    var hoy = U.hoyIso();
    var h = '<h1>Calendario</h1><p class="sub">' + D.temporada.meta.sesiones +
      ' sesiones con ficha, de ' + e(U.fechaCorta(D.temporada.meta.inicio)) + ' a ' +
      e(U.fechaCorta(D.temporada.meta.fin)) + '. Martes 75 min, viernes 105.</p>';

    D.temporada.bloques.forEach(function (b) {
      var sesiones = D.sesionesDeBloque(b.id);
      if (!sesiones.length) return;
      h += '<h2>' + e(b.nombre) + '</h2>';
      h += '<p class="silencio">' + e(b.descripcion) + '</p>';
      h += '<p class="pequeno silencio">' + sesiones.length + ' sesiones · ' +
        e(U.rango(sesiones[0].fecha, sesiones[sesiones.length - 1].fecha)) + '</p>';
      h += '<div class="cal">';

      var lunesVisto = null;
      sesiones.forEach(function (s) {
        if (s.lunes !== lunesVisto) {
          lunesVisto = s.lunes;
          var semana = D.semanaDe(s.fecha);
          h += '<div class="cal__semana">' +
            '<span>' + e(U.rango(s.lunes, U.sumarDias(s.lunes, 6))) + '</span>' +
            (semana && semana.jornada
              ? '<span class="eti">J' + semana.jornada + ' · sáb ' +
                e(U.fechaCorta(semana.sabado)) + '</span>'
              : (semana && semana.sinPartido
                  ? '<span class="eti eti--bien">Sin partido</span>' : '')) +
            '</div>';
        }
        h += '<a class="cal__fila' + (s.fecha === hoy ? ' cal__fila--hoy' : '') +
          '" href="#/sesion/' + e(s.id) + '">' +
          '<span class="cal__dia">' + e(U.diaSemana(s.fecha).slice(0, 3)) + '</span>' +
          '<span class="cal__fecha">' + e(U.fechaCorta(s.fecha)) + '</span>' +
          '<span class="cal__tema">' + e(s.tema) + '</span>' +
          barraReparto(s) +
          '<span class="cal__min">' + s.duracion + '′</span></a>';
      });
      h += '</div>';
    });

    h += V.leyendaTipos();
    return h;
  };

  V.leyendaTipos = function () {
    var tipos = D.temporada.tipos;
    return '<div class="leyenda">' + Object.keys(tipos).map(function (t) {
      return '<span><i style="background:' + tipos[t].color + '"></i>' + e(tipos[t].nombre) + '</span>';
    }).join('') + '</div>';
  };

  /* --------------------------------------------------------------- ficha */

  V.sesion = function (id) {
    var s = D.sesion(id);
    if (!s) return '<h1>Esa sesión no existe</h1><p><a href="#/calendario">Ver el calendario</a></p>';

    var vec = D.vecinas(s);
    var bloque = D.bloque(s.bloque);

    var h = '<div class="ficha">';

    h += '<nav class="ficha__paso no-imprimir" aria-label="Sesiones del bloque">' +
      (vec.anterior
        ? '<a class="btn btn--icono" href="#/sesion/' + e(vec.anterior.id) + '" aria-label="Sesión anterior">‹</a>'
        : '<span class="btn btn--icono" aria-hidden="true">‹</span>') +
      '<span class="ficha__posicion">' + e(bloque ? bloque.corto : s.bloque) + ' · ' +
      vec.posicion + ' de ' + vec.total + '</span>' +
      (vec.siguiente
        ? '<a class="btn btn--icono" href="#/sesion/' + e(vec.siguiente.id) + '" aria-label="Sesión siguiente">›</a>'
        : '<span class="btn btn--icono" aria-hidden="true">›</span>') +
      '</nav>';

    h += '<h1>' + e(s.tema) + '</h1>';
    h += '<p class="sub">' + e(U.fechaLarga(s.fecha)) + '</p>';
    h += '<div class="etis">' + etiquetaDia(s) + etiquetaCarga(s.carga) +
      etiquetaMd(s) + etiquetaJornada(s) + '</div>';

    if (D.esVispera(s)) {
      h += '<div class="caja caja--aviso"><p><strong>Víspera de partido.</strong> ' +
        'Nada de contenido nuevo y nada de carga: la táctica va a intensidad ' +
        'cognitiva, no física.</p></div>';
    } else if (D.viernesQueCarga(s)) {
      h += '<div class="caja caja--acento"><p><strong>Viernes sin partido detrás.</strong> ' +
        'Es de las pocas sesiones largas que pueden cargar a intensidad real.</p></div>';
    }

    /* El cronómetro. Sin él la ficha es una lista; con él es la herramienta que
       se lleva al pabellón. */
    h += '<div class="crono no-imprimir">' +
      '<div class="crono__t" id="crono">00:00</div>' +
      '<div class="crono__estado" id="cronoEstado">Pulsa empezar cuando arranque el entrenamiento.</div>' +
      '<div class="crono__acc">' +
      '<button class="btn" id="cronoPlay" type="button">Empezar</button>' +
      '<button class="btn" id="cronoReset" type="button">Reiniciar</button>' +
      '</div></div>';

    h += '<div class="tl" id="tl" data-duracion="' + s.duracion + '">' +
      '<div class="tl__regla"></div><div class="tl__playhead" id="playhead"></div>';

    s.bloques.forEach(function (b, i) {
      h += V.bloqueFicha(b, i);
    });

    h += '</div>';

    h += '<div class="ficha__pie">' +
      V.leyendaTipos() + PZ.leyenda() +
      '<p class="pequeno silencio">«Pizarra» abre el dibujo y «Cómo se monta» la ' +
      'explicación completa: montaje paso a paso, errores frecuentes y cómo ajustarlo. ' +
      'Con eso no hace falta ningún libro en pista.</p>' +
      '<p class="pequeno silencio">12 jugadoras · 4 balones · trío = pasadora, ' +
      'ejecutante, reboteadora.</p>' +
      '<p class="no-imprimir"><button class="btn" type="button" data-accion="imprimir">Imprimir la ficha</button></p>' +
      '</div>';

    h += '</div>';
    return h;
  };

  V.bloqueFicha = function (b, i) {
    var ej = D.ejercicio(b.codigo);
    var tipo = ej ? ej.tipo : 'org';
    var minutos = b.hasta - b.desde;
    var id = 'pz' + i;

    var h = '<section class="blk blk--' + e(tipo) + '" data-desde="' + b.desde +
      '" data-hasta="' + b.hasta + '" style="--min:' + minutos + '">';
    h += '<div class="blk__min">' + b.desde + '–' + b.hasta + '</div>';
    h += '<div class="blk__barra" style="background:' + D.tipo(tipo).color + '"></div>';
    h += '<h3 class="blk__titulo">' +
      (D.esDeFamilia(b.codigo)
        ? '<a class="blk__cod" href="#/ejercicio/' + e(b.codigo) + '">' + e(b.codigo) + '</a>' : '') +
      e(ej ? ej.nombre : b.codigo) +
      (b.sinCanasta ? '<span class="blk__sc">sin canasta</span>' : '') + '</h3>';

    if (!ej) { return h + '</section>'; }

    if (ej.organizacion) h += '<div class="blk__meta">' + e(ej.organizacion) + '</div>';
    if (ej.clave) h += '<div class="blk__clave">' + e(ej.clave) + '</div>';
    if (ej.defensa) h += '<div class="blk__defe">' + e(ej.defensa) + '</div>';
    if (ej.marcador) h += '<div class="blk__comp"><b>Marcador</b> · ' + e(ej.marcador) + '</div>';
    if (ej.cita) h += '<div class="blk__cita">Ver también: ' + e(ej.cita) + '</div>';

    var botones = '';
    if (ej.diagrama) {
      botones += '<button class="plega" type="button" aria-expanded="false" ' +
        'aria-controls="' + id + '" data-abrir="Pizarra">Pizarra</button>';
    }
    if (ej.detalle) {
      botones += '<button class="plega" type="button" aria-expanded="false" ' +
        'aria-controls="d' + id + '" data-abrir="Cómo se monta">Cómo se monta</button>';
    }
    if (botones) h += '<div class="blk__btns no-imprimir">' + botones + '</div>';

    if (ej.diagrama) {
      h += '<div class="desplegable" id="' + id + '">' + PZ.completa(ej.diagrama, e) + '</div>';
    }
    if (ej.detalle) {
      h += '<div class="desplegable" id="d' + id + '">' + V.detalle(ej.detalle) + '</div>';
    }

    return h + '</section>';
  };

  V.detalle = function (d) {
    function lista(a, clase) {
      return '<ul' + (clase ? ' class="' + clase + '"' : '') + '>' +
        a.map(function (x) { return '<li>' + e(x) + '</li>'; }).join('') + '</ul>';
    }
    var h = '<div class="detalle">';
    if (d.m) h += '<h4>Cómo se monta</h4>' + lista(d.m);
    if (d.e) h += '<h4>Errores frecuentes</h4>' + lista(d.e, 'detalle__err');
    if (d.a) h += '<h4>Ajuste</h4>' + lista(d.a);
    return h + '</div>';
  };

  /* ------------------------------------------------------------ familias */

  var GRUPOS = { A: 'Técnica y táctica individual', B: 'Defensa',
                 C: 'Contraataque', D: 'Transversal' };

  V.familias = function (estado) {
    var r = D.buscar(estado.texto, estado.grupo);

    var h = '<h1>Familias</h1><p class="sub">' + D.temporada.meta.familias +
      ' familias. Se sube de nivel cuando el actual sale a velocidad de partido ' +
      'sin corrección tres veces seguidas.</p>';

    h += '<input class="buscador" id="buscarFamilia" type="search" ' +
      'placeholder="Buscar en familias y ejercicios" value="' + e(estado.texto) + '" ' +
      'aria-label="Buscar en familias y ejercicios">';

    h += '<div class="filtros">' + filtro('', 'Todas', estado.grupo) +
      Object.keys(GRUPOS).map(function (g) {
        return filtro(g, g + ' · ' + GRUPOS[g], estado.grupo);
      }).join('') + '</div>';

    if (estado.texto && r.ejercicios.length) {
      h += '<h2>Ejercicios que coinciden</h2><div class="lista">';
      h += r.ejercicios.slice(0, 30).map(V.enlaceEjercicio).join('');
      h += '</div>';
      if (r.ejercicios.length > 30) {
        h += '<p class="pequeno silencio">y ' + (r.ejercicios.length - 30) + ' más.</p>';
      }
    }

    if (!r.familias.length) {
      h += '<p class="silencio">Ninguna familia coincide.</p>';
      return h;
    }

    var grupoVisto = null;
    h += '<div class="lista">';
    r.familias.forEach(function (f) {
      if (f.grupo !== grupoVisto) {
        grupoVisto = f.grupo;
        h += '</div><h2>' + e(f.grupo) + ' · ' + e(GRUPOS[f.grupo] || f.grupo_nombre) + '</h2><div class="lista">';
      }
      var min = D.minutosDeFamilia(f.codigo);
      h += '<a class="enlace-tarjeta" href="#/familia/' + e(f.codigo) + '">' +
        '<div class="enlace-tarjeta__titulo"><span class="cod">' + e(f.codigo) + '</span> ' +
        e(f.nombre) + '</div>' +
        '<div class="enlace-tarjeta__pie">' +
        (f.niveles.length ? U.plural(f.niveles.length, 'nivel', 'niveles') : 'sin niveles numerados') +
        (min.total ? ' · ' + min.total + ' min en la temporada' : ' · no entra en ninguna sesión') +
        '</div></a>';
    });
    h += '</div>';
    return h;
  };

  function filtro(valor, etiqueta, actual) {
    return '<button class="filtro" type="button" data-grupo="' + e(valor) + '" ' +
      'aria-pressed="' + (actual === valor ? 'true' : 'false') + '">' + e(etiqueta) + '</button>';
  }

  V.enlaceEjercicio = function (ej) {
    var min = D.minutosDe(ej.codigo);
    return '<a class="enlace-tarjeta" href="#/ejercicio/' + e(ej.codigo) + '">' +
      '<div class="enlace-tarjeta__titulo">' +
      (D.esDeFamilia(ej.codigo) ? '<span class="cod">' + e(ej.codigo) + '</span> ' : '') +
      e(ej.nombre) + '</div>' +
      '<div class="enlace-tarjeta__pie">' + e(D.tipo(ej.tipo).nombre) +
      (min ? ' · ' + min + ' min en ' + U.plural(D.usosDe(ej.codigo).length, 'sesión', 'sesiones') : '') +
      '</div></a>';
  };

  V.familia = function (codigo) {
    var f = D.familia(codigo);
    if (!f) return '<h1>Esa familia no existe</h1><p><a href="#/familias">Ver todas</a></p>';

    var min = D.minutosDeFamilia(codigo);
    var h = '<p class="migas"><a href="#/familias">Familias</a> · ' +
      e(f.grupo) + ' · ' + e(GRUPOS[f.grupo] || f.grupo_nombre) + '</p>';
    h += '<h1><span class="cod">' + e(f.codigo) + '</span> ' + e(f.nombre) + '</h1>';
    if (f.apostilla) h += '<p class="sub">' + e(f.apostilla) + '</p>';
    if (f.nota) h += '<p class="silencio">' + e(f.nota) + '</p>';

    h += '<div class="cifras">' +
      cifra(min.total + ' min', 'En la temporada') +
      cifra(f.niveles.length || '—', 'Niveles') +
      '</div>';

    if (min.total) {
      h += '<h2>Reparto por bloque</h2><div class="barras">';
      var mayor = Math.max.apply(null, D.temporada.bloques.map(function (b) {
        return min.porBloque[b.id] || 0;
      })) || 1;
      D.temporada.bloques.forEach(function (b) {
        var v = min.porBloque[b.id] || 0;
        h += '<div class="barras__fila">' +
          '<span class="barras__et">' + e(b.corto) + '</span>' +
          '<span class="barras__pista"><i style="width:' + (v / mayor * 100).toFixed(1) + '%"></i></span>' +
          '<span class="barras__val">' + v + '′</span></div>';
      });
      h += '</div>';
    }

    if (f.niveles.length) {
      h += '<h2>Los niveles</h2>';
      f.niveles.forEach(function (n) {
        h += '<div class="tarjeta nivel">' +
          '<h3 class="nivel__titulo"><span class="cod">' + e(n.nivel) + '</span> ' + e(n.nombre) +
          (n.minutos ? '<span class="nivel__min">' + n.minutos + ' min</span>' : '') + '</h3>' +
          (n.formato ? '<p class="pequeno silencio">' + e(n.formato) + '</p>' : '') +
          /* El cuerpo va como HTML y no como texto plano: varios niveles llevan
             listas numeradas —las cuatro cosas de la 1ª línea de la zona— que
             aplastadas en un párrafo dejan de leerse. */
          (n.html ? '<div class="prosa">' + n.html + '</div>' : '');
        n.campos.forEach(function (c) {
          h += '<p class="campo"><span class="campo__et">' + e(c.etiqueta) + '</span> ' +
            e(c.texto) + '</p>';
        });
        var ej = D.ejercicio(f.codigo + '-' + n.nivel);
        if (ej) {
          h += '<p><a href="#/ejercicio/' + e(ej.codigo) + '">Ver la ficha de ' +
            e(ej.codigo) + ' · pizarra y montaje</a></p>';
        }
        h += '</div>';
      });

      /* Un nivel puede entrar en una sesión, con pizarra y montaje, sin estar
         descrito en el banco. Callarlo haría parecer que la familia tiene menos
         niveles de los que se entrenan. */
      var extra = D.nivelesSinDescribir(codigo);
      if (extra.length) {
        h += '<div class="caja caja--aviso"><h3>Y ' +
          U.plural(extra.length, 'nivel más que se entrena', 'niveles más que se entrenan') +
          '</h3><p>' + extra.map(function (x) {
            return '<a href="#/ejercicio/' + e(x.codigo) + '">' + e(x.codigo) + '</a>';
          }).join(' · ') + '</p>' +
          '<p class="pequeno">Tienen pizarra y montaje, pero el banco de ejercicios ' +
          'no los describe. Está en el original, no es un fallo de la web.</p></div>';
      }
    } else if (f.html) {
      h += '<div class="prosa">' + f.html + '</div>';
    } else {
      h += '<div class="caja caja--aviso"><p>Esta familia no tiene sección propia en el ' +
        'banco de ejercicios: su contenido está repartido por los documentos de ' +
        'planificación. <a href="#/plan">Ver el plan</a>.</p></div>';
    }

    var ejercicios = D.ejerciciosDeFamilia(codigo);
    if (ejercicios.length) {
      h += '<h2>Ejercicios que llegan a usarse</h2><div class="lista">' +
        ejercicios.map(V.enlaceEjercicio).join('') + '</div>';
    }

    return h;
  };

  /* ---------------------------------------------------------- ejercicio */

  V.ejercicio = function (codigo) {
    var ej = D.ejercicio(codigo);
    if (!ej) return '<h1>Ese ejercicio no existe</h1><p><a href="#/familias">Ver las familias</a></p>';

    var f = ej.familia ? D.familia(ej.familia) : null;
    var usos = D.usosDe(codigo);

    var h = '<p class="migas">' +
      (f ? '<a href="#/familia/' + e(f.codigo) + '">' + e(f.codigo) + ' · ' + e(f.nombre) + '</a>'
         : '<a href="#/familias">Familias</a>') + '</p>';
    h += '<h1>' + (D.esDeFamilia(codigo) ? '<span class="cod">' + e(codigo) + '</span> ' : '') +
      e(ej.nombre) + '</h1>';

    h += '<div class="etis">' +
      '<span class="eti eti--gris">' + e(D.tipo(ej.tipo).nombre) + '</span>' +
      (usos.length ? '<span class="eti">' + D.minutosDe(codigo) + ' min en ' +
        U.plural(usos.length, 'sesión', 'sesiones') + '</span>' : '') +
      '</div>';

    if (ej.organizacion) h += '<p class="sub">' + e(ej.organizacion) + '</p>';

    if (ej.diagrama) h += PZ.completa(ej.diagrama, e);

    if (ej.clave) h += '<div class="caja caja--acento"><h3>Clave</h3><p>' + e(ej.clave) + '</p></div>';
    if (ej.defensa) {
      h += '<div class="caja caja--aviso"><h3>La otra cara</h3><p>' + e(ej.defensa) + '</p>' +
        '<p class="pequeno">Cada desigualdad se entrena por las dos caras, con dos ' +
        'objetivos explícitos y el marcador midiendo los dos.</p></div>';
    }
    if (ej.marcador) h += '<p class="comp"><b>Marcador</b> · ' + e(ej.marcador) + '</p>';

    if (ej.detalle) h += V.detalle(ej.detalle);

    if (ej.cita) {
      h += '<p class="pequeno silencio">Ver también: ' + e(ej.cita) +
        '. Los libros son del entrenador y no se publican aquí; la ficha se basta sola.</p>';
    }

    if (usos.length) {
      h += '<h2>Dónde aparece</h2><div class="lista">';
      usos.forEach(function (u) {
        h += '<a class="enlace-tarjeta" href="#/sesion/' + e(u.sesion.id) + '">' +
          '<div class="enlace-tarjeta__titulo">' + e(u.sesion.tema) + '</div>' +
          '<div class="enlace-tarjeta__pie">' + e(U.fechaLarga(u.sesion.fecha)) +
          ' · minuto ' + u.desde + '–' + u.hasta + ' · ' + u.minutos + ' min' +
          (u.sinCanasta ? ' · sin canasta' : '') + '</div></a>';
      });
      h += '</div>';
    }

    return h;
  };

  /* --------------------------------------------------------------- plan */

  V.plan = function () {
    var h = '<h1>El plan</h1><p class="sub">Las decisiones que ordenan la temporada, y ' +
      'los documentos completos.</p>';

    D.temporada.secciones.forEach(function (s) {
      h += '<details class="plegable"><summary>' + e(s.titulo) + '</summary>' +
        '<div class="prosa">' + s.html + '</div></details>';
    });

    h += '<h2>Documentos</h2><div class="lista">';
    D.documentos.forEach(function (d) {
      h += '<a class="enlace-tarjeta" href="#/doc/' + e(d.id) + '">' +
        '<div class="enlace-tarjeta__titulo">' + e(d.titulo) + '</div>' +
        '<div class="enlace-tarjeta__pie">' + e(d.resumen) + '</div></a>';
    });
    h += '</div>';
    return h;
  };

  V.documento = function (id) {
    var d = D.documento(id);
    if (!d) return '<h1>Ese documento no existe</h1><p><a href="#/plan">Ver el plan</a></p>';
    return '<p class="migas"><a href="#/plan">El plan</a></p>' +
      '<h1>' + e(d.titulo) + '</h1>' +
      '<p class="sub">' + e(d.resumen) + '</p>' +
      '<div class="prosa">' + d.html + '</div>' +
      '<p class="pequeno silencio">Sale de <code>' + e(d.origen) + '</code>. ' +
      'La web no decide nada de lo deportivo: lo hace consultable.</p>';
  };

  /* ----------------------------------------------------------- rotaciones */

  function nombreTanda(t, formato) {
    return t.cuarto + 'º cuarto' + (formato.cambiosPorCuarto === 1 ? '' : ' · minuto ' + t.desde);
  }

  V.rotaciones = function (r, ui) {
    var p = r.partido;
    var nombres = {};
    r.plantilla.forEach(function (j, i) { nombres[j.id] = D.nombreJugadora(j, i); });
    var lista = function (ids) {
      return ids.map(function (id) { return e(nombres[id]); }).join(', ');
    };

    var h = '<h1>Rotaciones</h1>';
    var jornada = D.proximaJornada(ui.hoy);
    var criterio = D.criterioMinutos(jornada ? jornada.bloque : null);
    if (jornada) {
      var bloque = D.bloque(jornada.bloque);
      h += '<p class="sub">Reparto de minutos del próximo partido: J' + jornada.jornada +
        ' · sábado ' + e(U.fechaCorta(jornada.sabado)) +
        (bloque ? ' · ' + e(bloque.corto) : '') + '</p>';
    } else {
      h += '<p class="sub">Reparto de minutos de un partido.</p>';
    }
    h += '<div class="caja caja--acento"><h3>Lo que dice el plan</h3><p>' + e(criterio.texto) +
      '</p></div>';

    /* -- plantilla */
    h += '<details class="plegable" id="rotPlantilla"' +
      (ui.plantillaAbierta || !r.plantilla.length ? ' open' : '') + '>' +
      '<summary>Plantilla · ' + U.plural(r.plantilla.length, 'jugadora', 'jugadoras') + '</summary>';
    h += '<p class="pequeno silencio">Se guarda solo en este navegador. No se sube al ' +
      'repositorio ni a ningún servidor. Si lo prefieres, basta con el dorsal.</p>';
    if (!r.plantilla.length) {
      h += '<p><button class="btn btn--principal" type="button" data-accion="rot-doce">' +
        'Empezar con 12 jugadoras</button></p>';
    }
    h += '<div class="rot__plantilla">';
    r.plantilla.forEach(function (j, i) {
      h += '<div class="rot__jugadora">' +
        '<input class="campoTexto rot__dorsal" id="rotDorsal-' + e(j.id) + '" data-campo="dorsal" ' +
        'data-id="' + e(j.id) + '" value="' + e(j.dorsal) + '" placeholder="Nº" ' +
        'inputmode="numeric" maxlength="3" aria-label="Dorsal">' +
        '<input class="campoTexto" id="rotNombre-' + e(j.id) + '" data-campo="nombre" ' +
        'data-id="' + e(j.id) + '" value="' + e(j.nombre) + '" placeholder="Jugadora ' + (i + 1) +
        '" maxlength="30" aria-label="Nombre">' +
        '<button class="btn btn--icono" type="button" data-accion="rot-quitar" data-id="' +
        e(j.id) + '" aria-label="Quitar a ' + e(nombres[j.id]) + '">×</button></div>';
    });
    h += '</div><p><button class="btn" type="button" data-accion="rot-anadir">Añadir jugadora</button>' +
      (r.plantilla.length ? ' <button class="btn" type="button" data-accion="rot-borrar">' +
        'Borrar todo</button>' : '') + '</p></details>';

    if (!r.plantilla.length) return h;

    /* -- formato y convocatoria */
    h += '<h2>El partido</h2>';
    h += '<div class="rot__formato">' +
      '<label>Cuartos <input class="campoTexto" type="number" inputmode="numeric" min="1" max="8" ' +
      'data-formato="cuartos" value="' + p.cuartos + '"></label>' +
      '<label>Minutos por cuarto <input class="campoTexto" type="number" inputmode="numeric" ' +
      'min="2" max="20" data-formato="minCuarto" value="' + p.minCuarto + '"></label>' +
      '<label>Mínimo (min) <input class="campoTexto" type="number" inputmode="numeric" ' +
      'min="0" max="80" data-formato="minimo" value="' + p.minimo + '"></label></div>';
    h += '<div class="filtros" role="group" aria-label="Cuándo se cambia">' +
      '<button class="filtro" type="button" data-accion="rot-cambios" data-valor="2" aria-pressed="' +
      (p.cambiosPorCuarto !== 1) + '">Cambios a mitad de cuarto</button>' +
      '<button class="filtro" type="button" data-accion="rot-cambios" data-valor="1" aria-pressed="' +
      (p.cambiosPorCuarto === 1) + '">Solo entre cuartos</button></div>';
    h += '<p class="pequeno silencio">Mínimo por jugadora. Se cuenta en tandas enteras de ' +
      D.tandas(p)[0].minutos + ' minutos, y con 0 nadie se queda a cero igualmente.</p>';

    h += '<h3>Convocatoria</h3><p class="pequeno silencio">«Más» y «menos» acortan o ' +
      'alargan la rotación sin bajar nunca del mínimo.</p><div class="rot__convocatoria">';
    r.plantilla.forEach(function (j) {
      var va = p.convocadas[j.id] !== false;
      var pr = p.prioridad[j.id] || 'normal';
      h += '<div class="rot__conv' + (va ? '' : ' rot__conv--fuera') + '">' +
        '<button class="filtro" type="button" data-accion="rot-convocar" data-id="' + e(j.id) +
        '" aria-pressed="' + va + '">' + e(nombres[j.id]) + '</button>';
      if (va) {
        h += '<span class="rot__prio" role="group" aria-label="Minutos de ' + e(nombres[j.id]) + '">' +
          [['menos', 'Menos'], ['normal', 'Igual'], ['mas', 'Más']].map(function (o) {
            return '<button class="filtro" type="button" data-accion="rot-prioridad" data-id="' +
              e(j.id) + '" data-valor="' + o[0] + '" aria-pressed="' + (pr === o[0]) + '">' +
              o[1] + '</button>';
          }).join('') + '</span>';
      }
      h += '</div>';
    });
    h += '</div>';

    var jugadoras = D.convocadas(r);
    if (jugadoras.length < D.EN_PISTA) {
      return h + '<div class="caja caja--aviso"><p>Hacen falta al menos cinco convocadas ' +
        'para repartir.</p></div>';
    }
    h += '<p><button class="btn btn--principal btn--ancho" type="button" data-accion="rot-repartir">' +
      'Repartir minutos</button></p>';

    var plan = D.planVigente(r);
    if (!plan) {
      if (p.plan) {
        h += '<p class="silencio">El formato ha cambiado desde el último reparto: vuelve a repartir.</p>';
      }
      return h;
    }

    /* -- el reparto */
    var res = D.resumenRotacion(p, jugadoras, plan);
    h += '<h2 id="rotReparto">El reparto</h2>';
    if (res.avisos.length) {
      h += '<div class="caja caja--aviso">' + res.avisos.map(function (a) {
        return '<p>' + e(a) + '</p>';
      }).join('') + '</div>';
    }
    h += '<p class="pequeno silencio">Toca una casilla para meter o sacar a una jugadora de ' +
      'esa tanda. Los minutos se recalculan solos.</p>';

    h += '<div class="desliza"><table class="tabla rot__tabla"><thead><tr><th>Jugadora</th>';
    res.tandas.forEach(function (t, i) {
      h += '<th class="rot__th' + (t.desde === 0 && i ? ' rot__th--cuarto' : '') + '">' +
        t.cuarto + 'º' + (p.cambiosPorCuarto === 1 ? '' : '<br><small>' + t.desde + '′</small>') +
        '</th>';
    });
    h += '<th class="rot__min">Min</th></tr></thead><tbody>';
    jugadoras.forEach(function (j) {
      var bajo = res.porDebajo.indexOf(j.id) >= 0;
      h += '<tr' + (j.baja ? ' class="rot__baja"' : '') + '><th scope="row">' + e(nombres[j.id]) +
        (j.baja ? ' <span class="eti eti--alarma">baja</span>' : '') + '</th>';
      plan.forEach(function (t, i) {
        var dentro = t.indexOf(j.id) >= 0;
        h += '<td class="rot__td' + (res.tandas[i].desde === 0 && i ? ' rot__th--cuarto' : '') + '">' +
          '<button class="rot__celda" type="button" data-accion="rot-celda" data-tanda="' + i +
          '" data-id="' + e(j.id) + '" aria-pressed="' + dentro + '" aria-label="' +
          e(nombres[j.id]) + ', ' + e(nombreTanda(res.tandas[i], p)) + '"></button></td>';
      });
      h += '<td class="rot__min' + (bajo ? ' rot__min--bajo' : '') + '">' +
        res.minutos[j.id] + '</td></tr>';
    });
    h += '</tbody><tfoot><tr><th>En pista</th>';
    plan.forEach(function (t, i) {
      h += '<td class="rot__td' + (t.length !== D.EN_PISTA ? ' rot__min--bajo' : '') +
        (res.tandas[i].desde === 0 && i ? ' rot__th--cuarto' : '') + '">' + t.length + '</td>';
    });
    h += '<td></td></tr></tfoot></table></div>';

    /* -- durante el partido */
    h += '<h2>Durante el partido</h2>' +
      '<p class="pequeno silencio">Si una se lesiona o se carga de faltas, márcala de baja y ' +
      'recalcula desde la tanda que va a empezar. Lo ya jugado no se toca.</p>';
    h += '<div class="filtros" role="group" aria-label="Bajas">' + jugadoras.map(function (j) {
      return '<button class="filtro" type="button" data-accion="rot-baja" data-id="' + e(j.id) +
        '" aria-pressed="' + j.baja + '">' + (j.baja ? 'Baja · ' : '') + e(nombres[j.id]) + '</button>';
    }).join('') + '</div>';
    h += '<div class="rot__recalcular"><label>Desde <select class="campoTexto" id="rotDesde">' +
      res.tandas.map(function (t, i) {
        return '<option value="' + i + '"' + (i === p.desde ? ' selected' : '') + '>' +
          e(nombreTanda(t, p)) + '</option>';
      }).join('') + '</select></label>' +
      '<button class="btn" type="button" data-accion="rot-recalcular">Recalcular el resto</button></div>';

    /* -- los cambios, para leerlos en el banquillo */
    h += '<h2>Los cambios</h2><ol class="rot__cambios">';
    res.cambios.forEach(function (c, i) {
      h += '<li><div class="rot__cuando">' + e(nombreTanda(c.tanda, p)) + '</div>';
      if (!i) {
        h += '<div><b>Quinteto inicial:</b> ' + lista(plan[0]) + '</div>';
      } else if (!c.entran.length && !c.salen.length) {
        h += '<div class="silencio">Sin cambios</div>';
      } else {
        h += '<div><b class="rot__entra">Entran:</b> ' + lista(c.entran) + '</div>' +
          '<div><b class="rot__sale">Salen:</b> ' + lista(c.salen) + '</div>';
      }
      h += '</li>';
    });
    h += '</ol>';
    h += '<p class="no-imprimir"><button class="btn" type="button" data-accion="imprimir">' +
      'Imprimir el reparto</button></p>';
    return h;
  };

  window.V = V;
}());
