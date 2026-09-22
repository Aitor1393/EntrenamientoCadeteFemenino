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

  window.D = D;
}());
