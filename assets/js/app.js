/* Rutas, eventos, cronómetro y arranque. Cuelga de window.App y necesita U, D, PZ y V. */
(function () {
  'use strict';

  var App = {
    estado: { texto: '', grupo: '' },
    /* El cronómetro vive aquí y no en la vista: las vistas se repintan enteras
       y el tiempo no puede reiniciarse porque se despliegue una pizarra. */
    crono: { acc: 0, t0: null, corriendo: false, tick: null, lock: null, sesion: null }
  };

  var RUTAS = [
    [/^\/?$|^\/hoy$/, function () { return V.hoy(D.queToca(U.hoyIso())); }],
    [/^\/calendario$/, function () { return V.calendario(); }],
    [/^\/sesion\/([\w-]+)$/, function (m) { return V.sesion(m[1]); }],
    [/^\/familias$/, function () { return V.familias(App.estado); }],
    [/^\/familia\/(F\d+)$/, function (m) { return V.familia(m[1]); }],
    [/^\/ejercicio\/([\w-]+)$/, function (m) { return V.ejercicio(m[1]); }],
    [/^\/rotaciones$/, function () {
      return V.rotaciones(App.rot(), { hoy: U.hoyIso(), plantillaAbierta: App.estado.plantillaAbierta });
    }],
    [/^\/plan$/, function () { return V.plan(); }],
    [/^\/doc\/([\w-]+)$/, function (m) { return V.documento(m[1]); }]
  ];

  function ruta() {
    return decodeURIComponent(location.hash.replace(/^#/, '')) || '/hoy';
  }

  App.pintar = function () {
    var r = ruta(), app = U.$('#app');
    for (var i = 0; i < RUTAS.length; i++) {
      var m = r.match(RUTAS[i][0]);
      if (!m) continue;
      try {
        app.innerHTML = RUTAS[i][1](m);
      } catch (err) {
        app.innerHTML = '<h1>Algo ha fallado al pintar</h1><p class="silencio">' +
          U.esc(err.message) + '</p>';
        throw err;
      }
      App.marcarNav(r);
      App.trasPintar(r, m);
      if (!App.sinSubir) window.scrollTo(0, 0);
      App.sinSubir = false;
      return;
    }
    app.innerHTML = '<h1>Esa página no existe</h1><p><a href="#/hoy">Volver a Hoy</a></p>';
  };

  /* Lo que hay que enganchar después de que la vista exista en el DOM. */
  App.trasPintar = function (r, m) {
    var enFicha = /^\/sesion\//.test(r);
    if (!enFicha) {
      App.pararCrono();
      App.crono.sesion = null;
      return;
    }
    /* Cambiar de sesión reinicia el tiempo: seguir contando el de la anterior
       sería peor que no contar nada. */
    if (App.crono.sesion !== m[1]) {
      App.pararCrono();
      App.crono.acc = 0;
      App.crono.sesion = m[1];
    }
    App.marcar();
  };

  App.marcarNav = function (r) {
    var raiz = '/' + (r.split('/')[1] || 'hoy');
    var equivalencias = {
      '/sesion': '/calendario', '/familia': '/familias',
      '/ejercicio': '/familias', '/doc': '/plan'
    };
    var activa = equivalencias[raiz] || raiz;
    U.$$('.nav a').forEach(function (a) {
      if (a.getAttribute('href').replace('#', '') === activa) {
        a.setAttribute('aria-current', 'page');
      } else {
        a.removeAttribute('aria-current');
      }
    });
  };

  /* ------------------------------------------------------------- cronómetro */

  App.minutos = function () {
    var c = App.crono;
    return (c.acc + (c.corriendo ? Date.now() - c.t0 : 0)) / 60000;
  };

  /* Resalta el bloque en curso, atenúa los pasados y coloca la línea naranja.

     El playhead se calcula sobre offsetTop/offsetHeight reales y no sobre la
     proporción teórica: los bloques cortos crecen para acomodar su contenido,
     así que la altura teórica y la real no coinciden. Por eso hay que volver a
     llamar aquí al desplegar una pizarra o al cambiar el tamaño. */
  App.marcar = function () {
    var tl = U.$('#tl');
    if (!tl) return;

    var c = App.crono;
    var m = App.minutos();
    var activo = c.corriendo || c.acc > 0;
    var duracion = +tl.getAttribute('data-duracion');
    var ph = U.$('#playhead');
    var estado = U.$('#cronoEstado');
    var actual = null;

    U.$$('.blk', tl).forEach(function (d) {
      var a = +d.getAttribute('data-desde'), z = +d.getAttribute('data-hasta');
      d.classList.toggle('hecho', activo && m >= z);
      var es = activo && m >= a && m < z;
      d.classList.toggle('ahora', es);
      if (es) actual = d;
    });

    if (activo && actual) {
      var a2 = +actual.getAttribute('data-desde'), z2 = +actual.getAttribute('data-hasta');
      var fr = (m - a2) / (z2 - a2);
      ph.style.display = 'block';
      ph.style.top = (actual.offsetTop + fr * actual.offsetHeight) + 'px';
      var quedan = Math.max(0, Math.ceil(z2 - m));
      var titulo = actual.querySelector('.blk__titulo');
      estado.innerHTML = '<b>' + U.esc(titulo ? titulo.textContent : '') + '</b><br>' +
        U.esc(U.plural(quedan, 'minuto', 'minutos')) + ' para el siguiente bloque';
    } else if (activo && m >= duracion) {
      ph.style.display = 'none';
      estado.innerHTML = '<b>Sesión completada.</b> Recoge y cierra con una idea.';
    } else {
      ph.style.display = 'none';
      if (!activo) estado.textContent = 'Pulsa empezar cuando arranque el entrenamiento.';
    }

    var seg = Math.floor(App.minutos() * 60);
    U.$('#crono').textContent =
      U.dosCifras(Math.floor(seg / 60)) + ':' + U.dosCifras(seg % 60);
  };

  /* Mantener la pantalla encendida mientras corre el tiempo. Si el navegador no
     lo permite, se sigue sin ello: no es motivo para romper nada. */
  App.despertar = function (encender) {
    var c = App.crono;
    try {
      if (encender && 'wakeLock' in navigator) {
        navigator.wakeLock.request('screen').then(function (l) { c.lock = l; }, function () {});
      } else if (c.lock) {
        c.lock.release();
        c.lock = null;
      }
    } catch (err) { /* sin wakeLock se entrena igual */ }
  };

  App.alternarCrono = function () {
    var c = App.crono;
    var boton = U.$('#cronoPlay');
    if (c.corriendo) {
      c.acc += Date.now() - c.t0;
      c.corriendo = false;
      clearInterval(c.tick);
      c.tick = null;
      if (boton) { boton.textContent = 'Seguir'; boton.classList.remove('btn--principal'); }
      App.despertar(false);
    } else {
      c.t0 = Date.now();
      c.corriendo = true;
      c.tick = setInterval(App.marcar, 1000);
      if (boton) { boton.textContent = 'Pausa'; boton.classList.add('btn--principal'); }
      App.despertar(true);
    }
    App.marcar();
  };

  App.pararCrono = function () {
    var c = App.crono;
    if (c.corriendo) c.acc += Date.now() - c.t0;
    c.corriendo = false;
    clearInterval(c.tick);
    c.tick = null;
    App.despertar(false);
  };

  App.reiniciarCrono = function () {
    App.pararCrono();
    App.crono.acc = 0;
    var boton = U.$('#cronoPlay');
    if (boton) { boton.textContent = 'Empezar'; boton.classList.remove('btn--principal'); }
    App.marcar();
  };

  /* ------------------------------------------------------------ rotaciones

     La plantilla y los repartos se guardan solo en este navegador. Son datos
     de menores: no van a data/, ni al repositorio, ni a ningún servidor. */

  App.rot = function () {
    if (!App._rot) App._rot = D.normalizarRotaciones(U.leer('rotaciones', null));
    return App._rot;
  };

  App.guardarRot = function (repintar) {
    U.guardar('rotaciones', App._rot);
    if (!repintar) return;
    /* Repintar se lleva el foco por delante; se devuelve al campo que lo tenía
       para que pasar de un nombre al siguiente no obligue a tocar dos veces. */
    var activo = document.activeElement && document.activeElement.id;
    App.sinSubir = true;
    App.pintar();
    var campo = activo && document.getElementById(activo);
    if (campo) campo.focus();
  };

  App.repartir = function (desde) {
    var r = App.rot();
    var p = r.partido;
    p.desde = desde;
    p.plan = D.repartirMinutos(p, D.convocadas(r), D.planVigente(r), desde);
  };

  /* Las acciones de la pantalla de rotaciones. Devuelve true si la ha atendido. */
  App.accionRot = function (boton) {
    var r = App.rot(), p = r.partido;
    var accion = boton.getAttribute('data-accion');
    var id = boton.getAttribute('data-id');
    var valor = boton.getAttribute('data-valor');

    if (accion === 'rot-doce') {
      for (var i = 0; i < 12; i++) r.plantilla.push({ id: 'j' + Date.now() + i, dorsal: '', nombre: '' });
    } else if (accion === 'rot-anadir') {
      r.plantilla.push({ id: 'j' + Date.now(), dorsal: '', nombre: '' });
      App.estado.plantillaAbierta = true;
    } else if (accion === 'rot-quitar') {
      r.plantilla = r.plantilla.filter(function (j) { return j.id !== id; });
    } else if (accion === 'rot-borrar') {
      if (!window.confirm('¿Borrar la plantilla y el reparto de este navegador?')) return true;
      App._rot = D.normalizarRotaciones(null);
    } else if (accion === 'rot-cambios') {
      p.cambiosPorCuarto = +valor;
    } else if (accion === 'rot-convocar') {
      p.convocadas[id] = p.convocadas[id] === false;
    } else if (accion === 'rot-prioridad') {
      p.prioridad[id] = valor;
    } else if (accion === 'rot-repartir') {
      p.bajas = {};
      App.repartir(0);
      App.guardarRot(true);
      var destino = U.$('#rotReparto');
      if (destino) destino.scrollIntoView({ block: 'start' });
      return true;
    } else if (accion === 'rot-celda') {
      var plan = D.planVigente(r);
      var t = plan[+boton.getAttribute('data-tanda')];
      var k = t.indexOf(id);
      if (k >= 0) t.splice(k, 1); else t.push(id);
      p.plan = plan;
    } else if (accion === 'rot-baja') {
      p.bajas[id] = !p.bajas[id];
    } else if (accion === 'rot-recalcular') {
      App.repartir(+U.$('#rotDesde').value);
    } else {
      return false;
    }
    App.guardarRot(true);
    return true;
  };

  /* ------------------------------------------------------------------ tema */

  App.tema = function (valor) {
    if (valor) {
      document.documentElement.setAttribute('data-tema', valor);
      U.guardar('tema', valor);
    }
    return document.documentElement.getAttribute('data-tema');
  };

  App.alternarTema = function () {
    var oscuro = App.tema() === 'oscuro' ||
      (!App.tema() && window.matchMedia('(prefers-color-scheme: dark)').matches);
    App.tema(oscuro ? 'claro' : 'oscuro');
  };

  /* --------------------------------------------------------------- eventos */

  function eventos() {
    window.addEventListener('hashchange', App.pintar);
    U.$('#btnTema').addEventListener('click', App.alternarTema);

    /* Delegación: las vistas se repintan enteras, así que no se enganchan
       escuchadores a nada que se acabe de crear. */
    document.addEventListener('click', function (ev) {
      var t = ev.target;

      if (t.closest('[data-accion="imprimir"]')) { window.print(); return; }
      if (t.closest('#cronoPlay')) { App.alternarCrono(); return; }
      if (t.closest('#cronoReset')) { App.reiniciarCrono(); return; }

      var plega = t.closest('.plega');
      if (plega) {
        var panel = document.getElementById(plega.getAttribute('aria-controls'));
        var abierto = panel.classList.toggle('abierto');
        /* El botón conserva su nombre al abrirse. Cambiarlo por «Ocultar» deja
           dos botones idénticos cuando están abiertos la pizarra y el montaje,
           y ya no se sabe cuál cierra cuál: que esté abierto lo dicen el estado
           pulsado y aria-expanded. */
        plega.setAttribute('aria-expanded', abierto ? 'true' : 'false');
        App.marcar();   // el bloque ha cambiado de alto: el playhead se mueve
        return;
      }

      var rot = t.closest('[data-accion^="rot-"]');
      if (rot && App.accionRot(rot)) return;

      var filtro = t.closest('.filtro[data-grupo]');
      if (filtro) {
        App.estado.grupo = filtro.getAttribute('data-grupo');
        App.sinSubir = true;
        App.pintar();
      }
    });

    /* Los nombres se guardan al teclear y no se repinta: repintar movería el
       cursor, y hacerlo al salir del campo se come el toque que lo ha hecho
       salir —el botón de Repartir desaparece bajo el dedo—. Lo que enseña los
       nombres se pinta con el siguiente toque en cualquier botón. */
    document.addEventListener('input', function (ev) {
      var campo = ev.target.getAttribute('data-campo');
      if (!campo) return;
      var j = App.rot().plantilla.filter(function (x) {
        return x.id === ev.target.getAttribute('data-id');
      })[0];
      if (j) { j[campo] = ev.target.value; App.guardarRot(false); }
    });

    document.addEventListener('change', function (ev) {
      var formato = ev.target.getAttribute('data-formato');
      if (!formato) return;
      var p = App.rot().partido;
      p[formato] = +ev.target.value;
      App._rot = D.normalizarRotaciones(App._rot);
      App.guardarRot(true);
    });

    document.addEventListener('toggle', function (ev) {
      if (ev.target.id === 'rotPlantilla') App.estado.plantillaAbierta = ev.target.open;
    }, true);

    document.addEventListener('input', function (ev) {
      if (ev.target.id !== 'buscarFamilia') return;
      App.estado.texto = ev.target.value;
      App.sinSubir = true;
      var pos = ev.target.selectionStart;
      App.pintar();
      var campo = U.$('#buscarFamilia');
      if (campo) { campo.focus(); campo.setSelectionRange(pos, pos); }
    });

    window.addEventListener('resize', App.marcar);

    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') {
        if (App.crono.corriendo) App.despertar(true);
        App.marcar();
      }
    });
  }

  /* -------------------------------------------------------------- arranque */

  App.arrancar = function () {
    var guardado = U.leer('tema', null);
    if (guardado) App.tema(guardado);

    D.cargar().then(function () {
      eventos();
      App.pintar();
      App.pie();
    }).catch(function (err) {
      U.$('#app').innerHTML = '<h1>No se han podido cargar los datos</h1>' +
        '<p class="silencio">' + U.esc(err.message) + '</p>' +
        '<p>Si has abierto el archivo directamente desde el disco, el navegador ' +
        'bloquea la lectura de <code>data/</code>. Hace falta servirlo, por ejemplo con ' +
        '<code>python3 -m http.server</code>.</p>';
    });
  };

  App.pie = function () {
    var m = D.temporada.meta;
    U.$('#pieDatos').textContent = m.sesiones + ' sesiones · ' + m.familias +
      ' familias · ' + m.ejercicios + ' ejercicios';
  };

  window.App = App;
  document.addEventListener('DOMContentLoaded', App.arrancar);
}());
