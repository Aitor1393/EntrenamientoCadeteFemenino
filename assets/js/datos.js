/* El modelo. Carga lo generado y responde a las preguntas del entrenador:
   qué toca hoy, qué hay esta semana, dónde se entrena cada familia.

   Aquí van las reglas; vistas.js solo pinta. Si te ves calculando algo dentro
   de un V., casi seguro va aquí.

   Cuelga de window.D y necesita U. */
(function () {
  'use strict';

  var D = {
    temporada: null,
    familias: null,
    ejercicios: null,
    sesiones: null,
    documentos: null,
    porCodigo: {},     // F9-N3 -> familia
    porId: {},         // M1-7  -> sesión
    cargado: false
  };

  D.cargar = function () {
    var archivos = ['temporada', 'familias', 'ejercicios', 'sesiones', 'documentos'];
    return Promise.all(archivos.map(function (n) {
      return fetch('data/' + n + '.json').then(function (r) {
        if (!r.ok) throw new Error('no se ha podido leer data/' + n + '.json');
        return r.json();
      });
    })).then(function (r) {
      D.temporada = r[0];
      D.familias = r[1];
      D.ejercicios = r[2];
      D.sesiones = r[3];
      D.documentos = r[4];
      D.familias.forEach(function (f) { D.porCodigo[f.codigo] = f; });
      D.sesiones.forEach(function (s) { D.porId[s.id] = s; });
      D.cargado = true;
      return D;
    });
  };

  /* ------------------------------------------------------------- sesiones */

  D.sesion = function (id) { return D.porId[id] || null; };

  D.bloque = function (id) {
    return D.temporada.bloques.filter(function (b) { return b.id === id; })[0] || null;
  };

  D.sesionesDeBloque = function (id) {
    return D.sesiones.filter(function (s) { return s.bloque === id; });
  };

  D.sesionDeFecha = function (iso) {
    return D.sesiones.filter(function (s) { return s.fecha === iso; })[0] || null;
  };

  /* La primera sesión a partir de una fecha, sin límite de ventana: entre el
     18 de diciembre y el 12 de enero hay tres semanas y media sin nada, y la
     pantalla de Hoy tiene que seguir diciendo qué viene después. */
  D.proximaSesion = function (iso) {
    for (var i = 0; i < D.sesiones.length; i++) {
      if (D.sesiones[i].fecha > iso) return D.sesiones[i];
    }
    return null;
  };

  D.sesionAnterior = function (iso) {
    var previa = null;
    D.sesiones.forEach(function (s) { if (s.fecha < iso) previa = s; });
    return previa;
  };

  /* Vecinas dentro del mismo bloque, que es como se navega en la ficha. */
  D.vecinas = function (sesion) {
    var hermanas = D.sesionesDeBloque(sesion.bloque);
    var i = hermanas.indexOf(sesion);
    return { anterior: hermanas[i - 1] || null, siguiente: hermanas[i + 1] || null,
             posicion: i + 1, total: hermanas.length };
  };

  /* ---------------------------------------------------------------- semana */

  D.semanaDe = function (iso) {
    var lunes = U.lunesDe(iso);
    var sesiones = D.sesiones.filter(function (s) { return s.lunes === lunes; });
    if (!sesiones.length) return null;
    var conJornada = sesiones.filter(function (s) { return s.jornada; })[0];
    return {
      lunes: lunes,
      domingo: U.sumarDias(lunes, 6),
      sesiones: sesiones,
      jornada: conJornada ? conJornada.jornada : null,
      /* Una semana «sin partido» es la que el calendario de competición marca
         como libre, no cualquiera que no tenga jornada: en pretemporada no hay
         ninguna, y decir ahí «sin partido» sugiere un descanso que no existe. */
      sinPartido: sesiones.some(function (s) { return s.sinPartido; }),
      sabado: U.sumarDias(lunes, 5),
      bloque: sesiones[0].bloque
    };
  };

  /* Días hasta el partido. El martes es MD-4 y el viernes MD-1, y esa distancia
     es la que decide qué puede llevar la sesión: el martes toda la carga
     física, el viernes táctica a intensidad cognitiva. Sin partido no hay MD:
     son los tres viernes de M1 que sí pueden cargar. */
  D.md = function (sesion) {
    var semana = D.semanaDe(sesion.fecha);
    if (!semana || !semana.jornada) return null;
    return -U.diasEntre(sesion.fecha, semana.sabado);
  };

  D.esVispera = function (sesion) { return D.md(sesion) === -1; };

  /* El viernes sin partido detrás es la excepción que permite cargar de verdad:
     son tres en M1 y alguno suelto después, y cambian lo que cabe en la sesión.
     La pretemporada no cuenta: ahí no hay competición todavía, así que ningún
     viernes es «el viernes libre» de nada. */
  D.viernesQueCarga = function (sesion) {
    return U.diaSemana(sesion.fecha) === 'viernes' && sesion.sinPartido;
  };

  /* ------------------------------------------------------------------ hoy */

  /* Qué pasa un día concreto.
     Estados: sesion · partido · sinPartido · descanso · fuera */
  D.queToca = function (iso) {
    var meta = D.temporada.meta;
    var base = { fecha: iso, dia: U.diaSemana(iso) };

    if (iso < meta.inicio || iso > meta.fin) {
      base.estado = 'fuera';
      base.proxima = D.proximaSesion(iso);
      return base;
    }

    var sesion = D.sesionDeFecha(iso);
    if (sesion) {
      base.estado = 'sesion';
      base.sesion = sesion;
      base.semana = D.semanaDe(iso);
      return base;
    }

    var semana = D.semanaDe(iso);
    base.semana = semana;
    if (base.dia === 'sabado' && semana) {
      base.estado = semana.jornada ? 'partido' : 'sinPartido';
      return base;
    }

    base.estado = 'descanso';
    base.proxima = D.proximaSesion(iso);
    base.anterior = D.sesionAnterior(iso);
    return base;
  };

  /* ---------------------------------------------------------- ejercicios */

  D.ejercicio = function (codigo) { return D.ejercicios[codigo] || null; };

  D.familia = function (codigo) { return D.porCodigo[codigo] || null; };

  D.tipo = function (id) {
    return D.temporada.tipos[id] || { nombre: id, color: '#8A8073' };
  };

  /* Un ejercicio de familia lleva código visible («F9-N3»); los de organización
     —tiros libres, charla, 5c5— no, porque no pertenecen a ninguna. */
  D.esDeFamilia = function (codigo) { return /^F\d+-N\d+$/.test(codigo); };

  /* En qué sesiones aparece un ejercicio, y cuántos minutos suma. Es lo que
     convierte un ejercicio en algo interpretable: si es contenido fijo de todas
     las semanas o entra una vez en toda la temporada. */
  D.usosDe = function (codigo) {
    var usos = [];
    D.sesiones.forEach(function (s) {
      s.bloques.forEach(function (b) {
        if (b.codigo === codigo) {
          usos.push({ sesion: s, desde: b.desde, hasta: b.hasta,
                      minutos: b.hasta - b.desde, sinCanasta: b.sinCanasta });
        }
      });
    });
    return usos;
  };

  D.minutosDe = function (codigo) {
    return D.usosDe(codigo).reduce(function (n, u) { return n + u.minutos; }, 0);
  };

  /* Todos los ejercicios de una familia que llegan a usarse, en orden de nivel. */
  D.ejerciciosDeFamilia = function (codigo) {
    return Object.keys(D.ejercicios)
      .filter(function (c) { return D.ejercicios[c].familia === codigo; })
      .sort(function (a, b) {
        return (+a.split('-N')[1] || 0) - (+b.split('-N')[1] || 0);
      })
      .map(function (c) { return D.ejercicios[c]; });
  };

  /* Los niveles de una familia que se usan en alguna sesión y que el banco de
     ejercicios no llega a describir. Pasa con la zona (F9-N6 y N7), con las
     situaciones especiales y con el ataque contra zona. */
  D.nivelesSinDescribir = function (codigo) {
    var f = D.familia(codigo);
    if (!f) return [];
    var descritos = f.niveles.map(function (n) { return n.nivel; });
    return D.ejerciciosDeFamilia(codigo).filter(function (ej) {
      return descritos.indexOf(ej.nivel) < 0;
    });
  };

  /* Minutos de una familia en toda la temporada, y desglosados por bloque.
     Con esto se ve de un vistazo que la defensa individual pasa de 22 minutos
     en M0 a 175 en M1, que es justo lo que el plan dice que corrige. */
  D.minutosDeFamilia = function (codigo) {
    var total = 0, porBloque = {};
    D.temporada.bloques.forEach(function (b) { porBloque[b.id] = 0; });
    D.sesiones.forEach(function (s) {
      s.bloques.forEach(function (b) {
        var e = D.ejercicios[b.codigo];
        if (e && e.familia === codigo) {
          var m = b.hasta - b.desde;
          total += m;
          porBloque[s.bloque] += m;
        }
      });
    });
    return { total: total, porBloque: porBloque };
  };

  /* El reparto de una sesión por tipo de bloque: cuánto preventivo, cuánta
     técnica, cuánto juego. */
  D.repartoDe = function (sesion) {
    var porTipo = {};
    sesion.bloques.forEach(function (b) {
      var e = D.ejercicios[b.codigo];
      var t = e ? e.tipo : 'org';
      porTipo[t] = (porTipo[t] || 0) + (b.hasta - b.desde);
    });
    return porTipo;
  };

  D.minutosSinCanasta = function (sesion) {
    return sesion.bloques.reduce(function (n, b) {
      return n + (b.sinCanasta ? b.hasta - b.desde : 0);
    }, 0);
  };

  /* --------------------------------------------------------------- buscar */

  /* Busca a la vez en familias y en ejercicios. Devuelve las dos listas por
     separado porque se pintan distinto. */
  D.buscar = function (texto, grupo) {
    var q = U.normalizar(texto || '').trim();

    var familias = D.familias.filter(function (f) {
      if (grupo && f.grupo !== grupo) return false;
      if (!q) return true;
      return U.normalizar([f.codigo, f.nombre, f.apostilla, f.nota].join(' ')).indexOf(q) >= 0;
    });

    var ejercicios = Object.keys(D.ejercicios).map(function (c) {
      return D.ejercicios[c];
    }).filter(function (e) {
      if (grupo) {
        var f = e.familia && D.porCodigo[e.familia];
        if (!f || f.grupo !== grupo) return false;
      }
      if (!q) return false;   // sin texto solo se listan familias
      var campos = [e.codigo, e.nombre, e.organizacion, e.clave, e.defensa, e.marcador];
      if (e.detalle) {
        campos = campos.concat(e.detalle.m || [], e.detalle.e || [], e.detalle.a || []);
      }
      return U.normalizar(campos.join(' ')).indexOf(q) >= 0;
    });

    return { familias: familias, ejercicios: ejercicios };
  };

  D.documento = function (id) {
    return D.documentos.filter(function (d) { return d.id === id; })[0] || null;
  };

  /* ------------------------------------------------------------ rotaciones

     El reparto de minutos de un partido. La plantilla y los repartos son datos
     de menores: viven solo en el navegador del entrenador y nunca en data/
     ni en el repositorio. Aquí solo hay cálculo; guardar lo hace App. */

  D.EN_PISTA = 5;
  D.PESOS = { menos: 0.5, normal: 1, mas: 2 };

  /* La primera jornada cuyo sábado no ha pasado todavía. */
  D.proximaJornada = function (iso) {
    for (var i = 0; i < D.sesiones.length; i++) {
      var s = D.sesiones[i];
      var sabado = U.sumarDias(s.lunes, 5);
      if (s.jornada && sabado >= iso) {
        return { jornada: s.jornada, sabado: sabado, bloque: s.bloque };
      }
    }
    return null;
  };

  /* Lo que dice el plan del reparto en cada bloque. M3 y M4 van juntos en los
     datos: en M3 la rotación se acorta, en el escenario B de M4 se vuelve al
     reparto máximo, y en ninguno de los dos se queda nadie a cero. */
  D.criterioMinutos = function (bloque) {
    if (bloque === 'M3_M4') {
      return {
        minimo: 0,
        texto: 'En M3 la rotación se acorta y prioriza el rendimiento, pero nadie se ' +
          'queda a cero: todas juegan en los cuatro partidos. Se anuncia en la primera ' +
          'sesión del bloque, con el motivo y con la fecha en que se vuelve al reparto ' +
          'amplio. En los grupos de clasificación de mayo, reparto máximo.'
      };
    }
    return {
      minimo: 10,
      texto: 'Nadie por debajo de 10 minutos durante M1 y M2.'
    };
  };

  /* Lo guardado en el navegador, con todo lo que falte puesto por defecto: así
     un estado viejo sigue cargando aunque se añada un campo. */
  D.normalizarRotaciones = function (r) {
    r = r && typeof r === 'object' ? r : {};
    var plantilla = Array.isArray(r.plantilla) ? r.plantilla : [];
    var p = r.partido && typeof r.partido === 'object' ? r.partido : {};
    var entero = function (v, def, min, max) {
      v = Math.round(+v);
      return isFinite(v) && v >= min && v <= max ? v : def;
    };
    return {
      reglas: (Array.isArray(r.reglas) ? r.reglas : []).filter(function (rg) {
        return rg && D.TIPOS_REGLA[rg.tipo] && Array.isArray(rg.jugadoras);
      }).map(function (rg, i) {
        return { id: String(rg.id || 'r' + Date.now() + i), tipo: rg.tipo,
                 n: entero(rg.n, 1, 0, 80), jugadoras: rg.jugadoras.map(String) };
      }),
      plantilla: plantilla.map(function (j, i) {
        return { id: String(j.id || 'j' + Date.now() + i),
                 dorsal: String(j.dorsal || ''), nombre: String(j.nombre || '') };
      }),
      partido: {
        cuartos: entero(p.cuartos, 4, 1, 8),
        minCuarto: entero(p.minCuarto, 10, 2, 20),
        cambiosPorCuarto: p.cambiosPorCuarto === 1 ? 1 : 2,
        minimo: entero(p.minimo, 10, 0, 80),
        convocadas: p.convocadas && typeof p.convocadas === 'object' ? p.convocadas : {},
        prioridad: p.prioridad && typeof p.prioridad === 'object' ? p.prioridad : {},
        bajas: p.bajas && typeof p.bajas === 'object' ? p.bajas : {},
        plan: Array.isArray(p.plan) ? p.plan : null,
        avisosReparto: Array.isArray(p.avisosReparto) ? p.avisosReparto : [],
        desde: entero(p.desde, 0, 0, 40)
      }
    };
  };

  /* «4 · Lucía», o lo que haya. Sin nombre ni dorsal, el puesto en la lista. */
  D.nombreJugadora = function (j, i) {
    var partes = [j.dorsal, j.nombre].filter(function (x) { return x && x.trim(); });
    return partes.length ? partes.join(' · ') : 'Jugadora ' + (i + 1);
  };

  /* Las convocadas, con su prioridad y si están de baja, en el orden de la
     plantilla. Es lo que entra en el reparto. */
  D.convocadas = function (r) {
    var p = r.partido;
    return r.plantilla.filter(function (j) { return p.convocadas[j.id] !== false; })
      .map(function (j) {
        return { id: j.id, prioridad: p.prioridad[j.id] || 'normal', baja: !!p.bajas[j.id] };
      });
  };

  /* El reparto guardado, si todavía vale para el formato de ahora, sin las
     que han dejado de estar convocadas. Si el formato ha cambiado, el reparto
     viejo no tiene arreglo: hay que volver a repartir. */
  D.planVigente = function (r) {
    var plan = r.partido.plan;
    if (!plan || plan.length !== D.tandas(r.partido).length) return null;
    var ids = D.convocadas(r).map(function (j) { return j.id; });
    return plan.map(function (t) {
      return ids.filter(function (id) { return t.indexOf(id) >= 0; });
    });
  };

  /* Los tramos entre cambio y cambio. Con dos por cuarto los cambios caen a
     mitad de cuarto y en cada descanso; con uno, solo entre cuartos. */
  D.tandas = function (formato) {
    var lista = [];
    var porCuarto = formato.cambiosPorCuarto === 1 ? 1 : 2;
    var largo = formato.minCuarto / porCuarto;
    for (var c = 0; c < formato.cuartos; c++) {
      for (var k = 0; k < porCuarto; k++) {
        lista.push({ cuarto: c + 1, desde: k * largo, hasta: (k + 1) * largo, minutos: largo });
      }
    }
    return lista;
  };

  /* Cuántas tandas tiene que jugar cada una para que nadie baje del mínimo:
     una tanda empezada cuenta entera. «Nadie a cero» es un mínimo de una. */
  function tandasMinimas(minimo, largo) {
    return Math.max(1, Math.ceil(minimo / largo));
  }

  /* ------------------------------------------------------------- reglas

     Cuatro tipos, todos del entrenador y no del plan:
       almenos   · siempre al menos N de estas en pista
       comomucho · como mucho N de estas a la vez
       maximo    · cada una de estas, como mucho N minutos
       minimo    · cada una de estas, al menos N minutos
     Los minutos se cuentan en tandas enteras: un máximo de 8 con tandas de 5
     es una tanda, porque una segunda ya serían 10. */

  D.TIPOS_REGLA = {
    almenos: { texto: 'Siempre al menos', unidad: 'en pista', grupo: true },
    comomucho: { texto: 'Como mucho', unidad: 'a la vez en pista', grupo: true },
    maximo: { texto: 'Máximo', unidad: 'minutos cada una', grupo: false },
    minimo: { texto: 'Mínimo', unidad: 'minutos cada una', grupo: false }
  };

  /* Las reglas que tocan a esta convocatoria, ya traducidas a tandas y sin
     las jugadoras de baja o no convocadas. Una regla de grupo que pide más de
     las que quedan se rebaja a las que hay, y se avisa. */
  function reglasEfectivas(reglas, libres, largo, total) {
    var ids = libres.map(function (j) { return j.id; });
    var grupos = [], limites = {}, avisos = [];
    ids.forEach(function (id) { limites[id] = { min: 0, max: total }; });
    (reglas || []).forEach(function (rg) {
      var dentro = (rg.jugadoras || []).filter(function (id) { return ids.indexOf(id) >= 0; });
      if (!dentro.length) return;
      if (rg.tipo === 'almenos' || rg.tipo === 'comomucho') {
        var n = rg.n;
        if (rg.tipo === 'almenos' && n > dentro.length) {
          avisos.push('«Siempre al menos ' + n + '» solo tiene ' + dentro.length +
            ' disponibles: se pide a las ' + dentro.length + '.');
          n = dentro.length;
        }
        grupos.push({ tipo: rg.tipo, n: n, ids: dentro });
      } else if (rg.tipo === 'maximo') {
        var tope = Math.floor(rg.n / largo);
        if (tope * largo !== rg.n) {
          avisos.push('Con tandas de ' + largo + ' minutos, un máximo de ' + rg.n +
            (tope ? ' se queda en ' + tope * largo + '.' : ' es no jugar.'));
        }
        dentro.forEach(function (id) {
          limites[id].max = Math.min(limites[id].max, tope);
        });
      } else if (rg.tipo === 'minimo') {
        dentro.forEach(function (id) {
          limites[id].min = Math.max(limites[id].min, Math.ceil(rg.n / largo));
        });
      }
    });
    return { grupos: grupos, limites: limites, avisos: avisos };
  }

  function cumpleGrupos(quinteto, grupos) {
    for (var g = 0; g < grupos.length; g++) {
      var c = 0;
      for (var i = 0; i < quinteto.length; i++) if (grupos[g].ids.indexOf(quinteto[i]) >= 0) c++;
      if (grupos[g].tipo === 'almenos' ? c < grupos[g].n : c > grupos[g].n) return false;
    }
    return true;
  }

  /* Todos los quintetos posibles que cumplen las reglas de grupo. Con doce son
     792 como mucho: se pueden mirar todos. */
  function quintetos(ids, k, grupos) {
    var out = [], actual = [];
    function rec(desde) {
      if (actual.length === k) {
        if (cumpleGrupos(actual, grupos)) out.push(actual.slice());
        return;
      }
      for (var i = desde; i <= ids.length - (k - actual.length); i++) {
        actual.push(ids[i]); rec(i + 1); actual.pop();
      }
    }
    rec(0);
    return out;
  }

  /* Reparte las tandas de `desde` en adelante; las anteriores se quedan como
     están, porque ya se han jugado.

     Primero decide cuántas tandas le tocan a cada una: el mínimo, y lo que
     sobra a quien lleve menos en proporción a su prioridad, sin pasar ningún
     máximo. Eso es el objetivo, y se persigue sin obligar.

     Lo que obliga son las reglas. Se busca tanda a tanda entre los quintetos
     que las cumplen, prefiriendo a quien más lejos está de su objetivo; a
     igualdad sigue en pista quien acaba de entrar —menos cambios— y descansa
     quien lleva dos seguidas. Si una elección deja el resto sin salida, se
     vuelve atrás. Si no hay manera de cumplirlo todo, se afloja en este orden
     y se dice: primero el mínimo general, luego las reglas de grupo. */
  D.repartirMinutos = function (formato, jugadoras, plan, desde, reglas) {
    /* De lo que menos a lo que más pesa: el mínimo general, los mínimos de
       cada una y, al final, quién tiene que estar en pista. «Nadie a cero» no
       se suelta mientras quede alguna regla de grupo en pie. */
    var sinMinimos = (reglas || []).filter(function (rg) { return rg.tipo !== 'minimo'; });
    var intentos = [
      { reglas: reglas, minimo: true, grupos: true, aviso: null },
      { reglas: reglas, minimo: false, grupos: true,
        aviso: 'Con estas reglas no llegan todas al mínimo general: se ha asegurado solo que nadie se quede a cero.' },
      { reglas: sinMinimos, minimo: false, grupos: true,
        aviso: 'Con estas reglas no caben los mínimos de minutos que has puesto: se han dejado fuera.' },
      { reglas: reglas, minimo: false, grupos: false,
        aviso: 'No hay forma de cumplir las reglas de «siempre al menos» y «como mucho» con esta convocatoria: este reparto no las tiene en cuenta. Revísalas.' }
    ];
    for (var i = 0; i < intentos.length; i++) {
      var r = repartir(formato, jugadoras, plan, desde, intentos[i].reglas, intentos[i]);
      if (r.plan) {
        if (intentos[i].aviso) r.avisos.push(intentos[i].aviso);
        return r;
      }
    }
    return repartir(formato, jugadoras, plan, desde, [], { minimo: false, grupos: false, forzar: true });
  };

  function repartir(formato, jugadoras, plan, desde, reglas, modo) {
    var tandas = D.tandas(formato);
    var total = tandas.length;
    var largo = tandas[0].minutos;
    desde = Math.max(0, Math.min(desde || 0, total));
    var fijas = (plan || []).slice(0, desde);
    while (fijas.length < desde) fijas.push([]);

    var ids = jugadoras.map(function (j) { return j.id; });
    var jugadas = {};
    ids.forEach(function (id) { jugadas[id] = 0; });
    fijas.forEach(function (t) {
      t.forEach(function (id) { if (id in jugadas) jugadas[id]++; });
    });

    var libres = jugadoras.filter(function (j) { return !j.baja; });
    var libresIds = libres.map(function (j) { return j.id; });
    var quedan = total - desde;
    var k = Math.min(D.EN_PISTA, libres.length);
    var ef = reglasEfectivas(reglas, libres, largo, total);
    var grupos = modo.grupos ? ef.grupos : [];
    var avisos = ef.avisos.slice();
    var general = modo.minimo ? tandasMinimas(formato.minimo, largo) : 1;

    /* Límites de cada una en tandas totales, contando lo ya jugado. Si una
       regla de máximo choca con el mínimo, manda la regla: es más concreta. */
    var lim = {};
    libres.forEach(function (j) {
      var l = ef.limites[j.id];
      var max = Math.max(jugadas[j.id], Math.min(l.max, jugadas[j.id] + quedan));
      var min = Math.max(general, l.min);
      if (l.max < min && l.max < general) min = l.max;
      lim[j.id] = { min: Math.min(min, max), max: max };
    });

    /* El objetivo. */
    var peso = function (j) { return D.PESOS[j.prioridad] || 1; };
    var obj = {};
    libres.forEach(function (j) { obj[j.id] = Math.max(jugadas[j.id], lim[j.id].min); });
    var extra = function (lista) {
      return lista.reduce(function (n, id) { return n + obj[id] - jugadas[id]; }, 0);
    };
    var cabeEnGrupos = function (id) {
      return grupos.every(function (g) {
        return g.tipo !== 'comomucho' || g.ids.indexOf(id) < 0 || extra(g.ids) < g.n * quedan;
      });
    };
    var dar = function (lista) {
      var mejor = null, v = Infinity;
      lista.forEach(function (id) {
        var j = libres[libresIds.indexOf(id)];
        if (obj[id] >= lim[id].max || !cabeEnGrupos(id)) return;
        var x = obj[id] / peso(j);
        if (x < v - 1e-9) { v = x; mejor = id; }
      });
      if (mejor) obj[mejor]++;
      return mejor;
    };
    grupos.forEach(function (g) {
      if (g.tipo !== 'almenos') return;
      while (extra(g.ids) < g.n * quedan && dar(g.ids)) { /* sigue */ }
    });
    while (extra(libresIds) < k * quedan && dar(libresIds)) { /* sigue */ }

    /* La búsqueda. */
    var candidatos = quintetos(libresIds, k, grupos);
    var racha = {};
    libresIds.forEach(function (id) {
      racha[id] = 0;
      for (var i = desde - 1; i >= 0 && fijas[i].indexOf(id) >= 0; i--) racha[id]++;
    });
    var cuenta = {};
    libresIds.forEach(function (id) { cuenta[id] = jugadas[id]; });

    /* Los sitios que las reglas de «siempre al menos» se quedan en cada tanda.
       Si los grupos no se pisan, se suman; si se pisan, vale el mayor. Lo que
       sobra es todo lo que tienen las demás para llegar a su mínimo. */
    var almenos = grupos.filter(function (g) { return g.tipo === 'almenos'; });
    var reservados = 0, enGrupo = [];
    var disjuntos = almenos.every(function (g, i) {
      return almenos.slice(i + 1).every(function (h) {
        return g.ids.every(function (id) { return h.ids.indexOf(id) < 0; });
      });
    });
    almenos.forEach(function (g) {
      reservados = disjuntos ? reservados + g.n : Math.max(reservados, g.n);
      g.ids.forEach(function (id) { if (enGrupo.indexOf(id) < 0) enGrupo.push(id); });
    });
    var fuera = libresIds.filter(function (id) { return enGrupo.indexOf(id) < 0; });

    /* ¿Puede acabarse todavía con `n` tandas por delante? No lo asegura del
       todo, pero corta casi todos los callejones antes de entrar en ellos. */
    function viable(n) {
      var faltaFuera = 0;
      fuera.forEach(function (id) { faltaFuera += Math.max(0, lim[id].min - cuenta[id]); });
      if (faltaFuera > Math.max(0, k - reservados) * n) return false;
      var huecos = 0, falta = 0;
      for (var i = 0; i < libresIds.length; i++) {
        var id = libresIds[i];
        var puede = Math.min(n, lim[id].max - cuenta[id]);
        var necesita = Math.max(0, lim[id].min - cuenta[id]);
        if (necesita > puede) return false;
        huecos += puede; falta += necesita;
      }
      if (huecos < k * n || falta > k * n) return false;
      return grupos.every(function (g) {
        var p = 0, f = 0;
        g.ids.forEach(function (id) {
          p += Math.min(n, lim[id].max - cuenta[id]);
          f += Math.max(0, lim[id].min - cuenta[id]);
        });
        return g.tipo === 'almenos' ? p >= g.n * n : f <= g.n * n;
      });
    }

    var elegidos = [], pasos = 0, LIMITE = 4000;
    function buscar(t) {
      if (t === total) return true;
      if (++pasos > LIMITE) return false;
      var n = total - t;
      var puntuados = [];
      for (var c = 0; c < candidatos.length; c++) {
        var q = candidatos[c], ok = true, pts = 0;
        for (var i = 0; i < q.length; i++) {
          var id = q[i];
          if (cuenta[id] >= lim[id].max) { ok = false; break; }
          pts += (obj[id] - cuenta[id]) / n;
          /* Llegar al mínimo pesa más que acercarse al objetivo. */
          pts += 2 * Math.max(0, lim[id].min - cuenta[id]) / n;
          if (racha[id] === 1) pts += 0.01;
          else if (racha[id] >= 2) pts -= 0.01;
        }
        if (!ok) continue;
        /* Quien necesita todas las que quedan para su mínimo tiene que estar. */
        for (var x = 0; x < libresIds.length && ok; x++) {
          var y = libresIds[x];
          if (lim[y].min - cuenta[y] >= n && q.indexOf(y) < 0) ok = false;
        }
        if (ok) puntuados.push([pts, c]);
      }
      puntuados.sort(function (a, b) { return b[0] - a[0] || a[1] - b[1]; });
      for (var p = 0; p < puntuados.length && p < 40; p++) {
        var elegido = candidatos[puntuados[p][1]];
        var antes = {};
        libresIds.forEach(function (id) {
          antes[id] = racha[id];
          if (elegido.indexOf(id) >= 0) { cuenta[id]++; racha[id]++; } else racha[id] = 0;
        });
        elegidos.push(elegido);
        if ((modo.forzar || viable(n - 1)) && buscar(t + 1)) return true;
        elegidos.pop();
        libresIds.forEach(function (id) {
          if (elegido.indexOf(id) >= 0) cuenta[id]--;
          racha[id] = antes[id];
        });
        if (pasos > LIMITE) return false;
      }
      return false;
    }

    if (!buscar(desde)) return { plan: null, avisos: avisos };
    var nuevo = fijas.map(function (t) { return t.slice(); });
    elegidos.forEach(function (q) {
      nuevo.push(ids.filter(function (id) { return q.indexOf(id) >= 0; }));
    });
    return { plan: nuevo, avisos: avisos };
  }

  /* Todo lo que se lee de un reparto: minutos de cada una, cuántas hay en pista
     en cada tanda, quién entra y quién sale, y lo que no cuadra. Sirve igual
     para el reparto calculado que para uno tocado a mano. */
  D.resumenRotacion = function (formato, jugadoras, plan, reglas) {
    var tandas = D.tandas(formato);
    var largo = tandas[0].minutos;
    var minutos = {};
    jugadoras.forEach(function (j) { minutos[j.id] = 0; });
    plan.forEach(function (t) {
      t.forEach(function (id) { if (id in minutos) minutos[id] += largo; });
    });

    var cambios = plan.map(function (t, i) {
      var antes = i ? plan[i - 1] : [];
      return {
        tanda: tandas[i],
        entran: t.filter(function (id) { return antes.indexOf(id) < 0; }),
        salen: antes.filter(function (id) { return t.indexOf(id) < 0; })
      };
    });

    var minimo = tandasMinimas(formato.minimo, largo) * largo;
    var ef = reglasEfectivas(reglas, jugadoras.filter(function (j) { return !j.baja; }), largo,
      tandas.length);
    var avisos = [];
    var malas = plan.map(function (t, i) {
      return t.length !== D.EN_PISTA || !cumpleGrupos(t, ef.grupos) ? i : -1;
    }).filter(function (i) { return i >= 0; });
    var cortas = plan.filter(function (t) { return t.length !== D.EN_PISTA; }).length;
    if (cortas) {
      avisos.push(U.plural(cortas, 'tanda no tiene', 'tandas no tienen') +
        ' exactamente cinco en pista.');
    }
    var fuera = plan.filter(function (t) { return !cumpleGrupos(t, ef.grupos); }).length;
    if (fuera) {
      avisos.push(U.plural(fuera, 'tanda se salta', 'tandas se saltan') +
        ' una regla de quién tiene que estar en pista.');
    }

    /* Por debajo: del mínimo general, o del de su regla. Por encima: de su
       máximo. Una regla de máximo por debajo del general manda sobre él. */
    var porDebajo = [], porEncima = [];
    jugadoras.forEach(function (j) {
      var l = ef.limites[j.id] || { min: 0, max: tandas.length };
      var min = Math.max(minimo, l.min * largo);
      if (l.max * largo < min) min = l.max * largo;
      if (minutos[j.id] < min) porDebajo.push(j.id);
      if (minutos[j.id] > l.max * largo) porEncima.push(j.id);
    });
    if (porDebajo.length) {
      avisos.push(U.plural(porDebajo.length, 'jugadora se queda', 'jugadoras se quedan') +
        ' por debajo de su mínimo.');
    }
    if (porEncima.length) {
      avisos.push(U.plural(porEncima.length, 'jugadora pasa', 'jugadoras pasan') +
        ' de su máximo de minutos.');
    }
    /* Que una regla del entrenador baje a alguien del mínimo del plan es una
       decisión suya, y manda; pero tiene que verse, no quedar escondida. */
    var bajoPlan = jugadoras.filter(function (j) {
      var l = ef.limites[j.id];
      return l && l.max * largo < minimo;
    }).length;
    if (bajoPlan) {
      avisos.push(U.plural(bajoPlan, 'jugadora tiene', 'jugadoras tienen') + ' un máximo por ' +
        'debajo del mínimo del plan (' + minimo + ' minutos). Manda tu regla.');
    }
    var posible = Math.floor(D.EN_PISTA * tandas.length / Math.max(1, jugadoras.length)) * largo;
    if (minimo > posible) {
      avisos.push('Con ' + jugadoras.length + ' convocadas no da para que todas lleguen a ' +
        minimo + ' minutos: el máximo igual para todas es ' + posible + '.');
    }

    return {
      tandas: tandas, minutos: minutos, cambios: cambios, minimo: minimo,
      porDebajo: porDebajo, porEncima: porEncima, malas: malas, avisos: avisos
    };
  };

  window.D = D;
}());
