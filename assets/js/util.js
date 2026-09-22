/* Utilidades sin dependencias: fechas, DOM y almacenamiento.
   Cuelga de window.U y no depende de ningún otro archivo. */
(function () {
  'use strict';

  var DIAS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
  var DIAS_LARGOS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
               'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  var U = {
    DIAS: DIAS,
    DIAS_LARGOS: DIAS_LARGOS,
    MESES: MESES,

    /* Las fechas se manejan como 'AAAA-MM-DD' y se construyen a mediodía.
       Con new Date('2027-01-12') el navegador interpreta UTC, y en España eso
       puede caer en el día anterior; a mediodía local nunca cambia de día. */
    aFecha: function (iso) {
      var p = iso.split('-');
      return new Date(+p[0], +p[1] - 1, +p[2], 12, 0, 0);
    },

    aIso: function (d) {
      return d.getFullYear() + '-' + U.dosCifras(d.getMonth() + 1) + '-' + U.dosCifras(d.getDate());
    },

    dosCifras: function (n) { return (n < 10 ? '0' : '') + n; },

    hoyIso: function () { return U.aIso(new Date()); },

    sumarDias: function (iso, n) {
      var d = U.aFecha(iso);
      d.setDate(d.getDate() + n);
      return U.aIso(d);
    },

    diaSemana: function (iso) { return DIAS[U.aFecha(iso).getDay()]; },

    /* El lunes de la semana de esa fecha. El domingo cuenta como final de la
       semana que acaba, no como principio de la siguiente. */
    lunesDe: function (iso) {
      var d = U.aFecha(iso).getDay();
      return U.sumarDias(iso, d === 0 ? -6 : 1 - d);
    },

    /* «martes 6 de octubre» */
    fechaLarga: function (iso) {
      var d = U.aFecha(iso);
      return DIAS_LARGOS[d.getDay()] + ' ' + d.getDate() + ' de ' + MESES[d.getMonth()];
    },

    /* «6 oct» */
    fechaCorta: function (iso) {
      var d = U.aFecha(iso);
      return d.getDate() + ' ' + MESES[d.getMonth()].slice(0, 3);
    },

    /* «6-9 oct» o «26 oct – 1 nov», como en los documentos */
    rango: function (desde, hasta) {
      var a = U.aFecha(desde), b = U.aFecha(hasta);
      if (a.getMonth() === b.getMonth()) {
        return a.getDate() + '-' + b.getDate() + ' ' + MESES[b.getMonth()].slice(0, 3);
      }
      return U.fechaCorta(desde) + ' – ' + U.fechaCorta(hasta);
    },

    /* Días entre dos fechas, positivo si la segunda es posterior. */
    diasEntre: function (a, b) {
      return Math.round((U.aFecha(b) - U.aFecha(a)) / 86400000);
    },

    /* «3 minutos» / «1 minuto» — concordar a mano sale más barato que una
       librería de plurales para los dos casos que hacen falta. */
    plural: function (n, singular, pluralForma) {
      return n + ' ' + (n === 1 ? singular : pluralForma);
    },

    esc: function (t) {
      return String(t == null ? '' : t)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    },

    $: function (sel, raiz) { return (raiz || document).querySelector(sel); },
    $$: function (sel, raiz) {
      return Array.prototype.slice.call((raiz || document).querySelectorAll(sel));
    },

    guardar: function (clave, valor) {
      try { localStorage.setItem('cf:' + clave, JSON.stringify(valor)); } catch (e) {}
    },

    leer: function (clave, porDefecto) {
      try {
        var v = localStorage.getItem('cf:' + clave);
        return v === null ? porDefecto : JSON.parse(v);
      } catch (e) { return porDefecto; }
    },

    /* Sin tildes y en minúscula, para buscar. */
    normalizar: function (t) {
      return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    }
  };

  window.U = U;
}());
