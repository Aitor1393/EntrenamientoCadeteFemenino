/* El motor de pizarras, portado tal cual de herramientas/plantilla_pre.html.
   Las coordenadas son medidas FIBA reales: 1 unidad = 10 cm.

   Media pista   viewBox="-7 -7 164 154"   150 x 140, el ataque va hacia arriba
   Pista entera  viewBox="-7 -7 294 164"   280 x 150, aros en x=15.75 y x=264.25

   No cambies el sweep-flag de los arcos de triple sin mirar el resultado: es 0
   en media pista y cambia de signo entre las dos mitades en pista completa. Si
   un arco sale hacia el lado contrario, es eso.

   Cuelga de window.PZ y no depende de nada. */
(function () {
  'use strict';

  var NAVY = '#1D3B54', CUERO = '#BE5A21', LIN = '#B6A98E', GRIS = '#8A8073';

  /* Cada pizarra lleva su propio marcador de flecha: en la web hay varias en la
     misma página y un id repetido haría que todas apuntasen al primero. */
  var secuencia = 0;

  function defs(id) {
    return '<defs><marker id="' + id + '" viewBox="0 0 10 10" refX="8" refY="5" ' +
      'markerWidth="5" markerHeight="5" orient="auto-start-reverse">' +
      '<path d="M0,1 L9,5 L0,9 z" fill="' + NAVY + '"/></marker></defs>';
  }

  function pistaMedia() {
    return '<rect x="0" y="0" width="150" height="140" fill="none" stroke="' + LIN + '" stroke-width="1.1"/>' +
      '<rect x="50.5" y="0" width="49" height="58" fill="none" stroke="' + LIN + '" stroke-width="1.1"/>' +
      '<circle cx="75" cy="58" r="18" fill="none" stroke="' + LIN + '" stroke-width="1.1"/>' +
      '<path d="M9,0 L9,29.9 A67.5,67.5 0 0 0 141,29.9 L141,0" fill="none" stroke="' + LIN + '" stroke-width="1.1"/>' +
      '<line x1="66" y1="12" x2="84" y2="12" stroke="' + LIN + '" stroke-width="1.7"/>' +
      '<circle cx="75" cy="15.75" r="2.6" fill="none" stroke="' + LIN + '" stroke-width="1.1"/>';
  }

  function aro(x0, s, sw) {
    return '<rect x="' + (s > 0 ? 0 : 222) + '" y="50.5" width="58" height="49" fill="none" stroke="' + LIN + '" stroke-width="1.1"/>' +
      '<circle cx="' + (x0 + s * 58) + '" cy="75" r="18" fill="none" stroke="' + LIN + '" stroke-width="1.1"/>' +
      '<line x1="' + (x0 + s * 12) + '" y1="66" x2="' + (x0 + s * 12) + '" y2="84" stroke="' + LIN + '" stroke-width="1.7"/>' +
      '<circle cx="' + (x0 + s * 15.75) + '" cy="75" r="2.6" fill="none" stroke="' + LIN + '" stroke-width="1.1"/>' +
      '<path d="M' + x0 + ',9 L' + (x0 + s * 29.9) + ',9 A67.5,67.5 0 0 ' + sw + ' ' +
      (x0 + s * 29.9) + ',141 L' + x0 + ',141" fill="none" stroke="' + LIN + '" stroke-width="1.1"/>';
  }

  function pistaCompleta() {
    return '<rect x="0" y="0" width="280" height="150" fill="none" stroke="' + LIN + '" stroke-width="1.1"/>' +
      '<line x1="140" y1="0" x2="140" y2="150" stroke="' + LIN + '" stroke-width="1.1"/>' +
      '<circle cx="140" cy="75" r="18" fill="none" stroke="' + LIN + '" stroke-width="1.1"/>' +
      aro(0, 1, 1) + aro(280, -1, 0);
  }

  /* Desplazamiento perpendicular del punto de control de la Bézier. 0 = recta. */
  function ctrl(x1, y1, x2, y2, cv) {
    var mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    var dx = x2 - x1, dy = y2 - y1, L = Math.sqrt(dx * dx + dy * dy) || 1;
    return [mx - dy / L * cv, my + dx / L * cv];
  }

  function flecha(marca, x1, y1, x2, y2, cv, tipo) {
    var dash = tipo === 'p' ? ' stroke-dasharray="6 4"' : '';
    if (cv) {
      var c = ctrl(x1, y1, x2, y2, cv);
      return '<path d="M' + x1 + ',' + y1 + ' Q' + c[0].toFixed(1) + ',' + c[1].toFixed(1) +
        ' ' + x2 + ',' + y2 + '" fill="none" stroke="' + NAVY + '" stroke-width="1.7"' +
        dash + ' marker-end="url(#' + marca + ')"/>';
    }
    return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 +
      '" stroke="' + NAVY + '" stroke-width="1.7"' + dash + ' marker-end="url(#' + marca + ')"/>';
  }

  function bote(marca, x1, y1, x2, y2) {
    var dx = x2 - x1, dy = y2 - y1, L = Math.sqrt(dx * dx + dy * dy) || 1;
    var ux = dx / L, uy = dy / L, px = -uy, py = ux;
    var n = Math.max(4, Math.round(L / 7)), d = 'M' + x1 + ',' + y1;
    for (var i = 1; i <= n; i++) {
      var t = i / n, a = (i % 2 ? 1 : -1) * 2.6;
      d += ' L' + (x1 + ux * L * t + px * a).toFixed(1) + ',' +
        (y1 + uy * L * t + py * a).toFixed(1);
    }
    return '<path d="' + d + '" fill="none" stroke="' + NAVY + '" stroke-width="1.6" ' +
      'marker-end="url(#' + marca + ')"/>';
  }

  function atac(x, y, t, bal) {
    var s = '<circle cx="' + x + '" cy="' + y + '" r="6.4" fill="' + NAVY + '"/>' +
      '<text x="' + x + '" y="' + (y + 2.6) + '" text-anchor="middle" ' +
      'font-size="8.4" font-weight="700" fill="#F6F1E7">' + t + '</text>';
    if (bal) {
      s += '<circle cx="' + (x + 8) + '" cy="' + (y - 6.4) + '" r="3" fill="none" ' +
        'stroke="' + CUERO + '" stroke-width="1.6"/>';
    }
    return s;
  }

  function defe(x, y, t) {
    return '<g stroke="' + CUERO + '" stroke-width="2.2" stroke-linecap="round">' +
      '<line x1="' + (x - 4.6) + '" y1="' + (y - 4.6) + '" x2="' + (x + 4.6) + '" y2="' + (y + 4.6) + '"/>' +
      '<line x1="' + (x + 4.6) + '" y1="' + (y - 4.6) + '" x2="' + (x - 4.6) + '" y2="' + (y + 4.6) + '"/></g>' +
      (t ? '<text x="' + (x + 7) + '" y="' + (y + 7) + '" font-size="7.6" font-weight="700" fill="' +
        CUERO + '">' + t + '</text>' : '');
  }

  function cono(x, y) {
    return '<path d="M' + x + ',' + (y - 5.2) + ' L' + (x + 4.6) + ',' + (y + 3.2) +
      ' L' + (x - 4.6) + ',' + (y + 3.2) + ' z" fill="none" stroke="' + GRIS + '" stroke-width="1.7"/>';
  }

  var PZ = {
    NAVY: NAVY, CUERO: CUERO, GRIS: GRIS,

    /* Orden de dibujo: desplazamientos, pases, botes, conos, defensoras y por
       último atacantes, que tienen que quedar encima de todo lo demás. */
    svg: function (d) {
      if (!d) return '';
      var marca = 'fm' + (++secuencia);
      var full = d.v === 'c';
      var vb = full ? '-7 -7 294 164' : '-7 -7 164 154';
      var g = defs(marca) + (full ? pistaCompleta() : pistaMedia());
      (d.mv || []).forEach(function (a) { g += flecha(marca, a[0], a[1], a[2], a[3], a[4] || 0, 'm'); });
      (d.ps || []).forEach(function (a) { g += flecha(marca, a[0], a[1], a[2], a[3], a[4] || 0, 'p'); });
      (d.dr || []).forEach(function (a) { g += bote(marca, a[0], a[1], a[2], a[3]); });
      (d.k || []).forEach(function (a) { g += cono(a[0], a[1]); });
      (d.x || []).forEach(function (a) { g += defe(a[0], a[1], a[2] || ''); });
      (d.o || []).forEach(function (a) { g += atac(a[0], a[1], a[2], a[3]); });
      return '<svg viewBox="' + vb + '" role="img" aria-label="Diagrama del ejercicio ' +
        'sobre la pista">' + g + '</svg>';
    },

    /* La pizarra con su pie explicativo. `esc` viene de U para no duplicarlo. */
    completa: function (d, esc) {
      if (!d) return '';
      return '<div class="pizarra">' + PZ.svg(d) +
        (d.t ? '<p class="pizarra__pie">' + esc(d.t) + '</p>' : '') + '</div>';
    },

    /* La leyenda de símbolos, que se dibuja con las mismas funciones para que
       no pueda separarse de lo que sale en las pizarras. */
    leyenda: function () {
      var marca = 'fm' + (++secuencia);
      function caja(interior, ancho, alto, vb) {
        return '<svg width="' + ancho + '" height="' + alto + '" viewBox="' + vb +
          '" aria-hidden="true">' + interior + '</svg>';
      }
      return '<div class="simbolos">' +
        '<span>' + caja('<circle cx="0" cy="0" r="6.4" fill="' + NAVY + '"/>', 20, 16, '-10 -8 20 16') + 'Atacante</span>' +
        '<span>' + caja(defe(0, 0, ''), 20, 16, '-10 -8 20 16') + 'Defensora</span>' +
        '<span>' + caja(cono(0, 1), 20, 16, '-10 -8 20 16') + 'Cono</span>' +
        '<span>' + caja(defs(marca) + '<line x1="1" y1="6" x2="31" y2="6" stroke="' + NAVY +
          '" stroke-width="1.7" marker-end="url(#' + marca + ')"/>', 36, 12, '0 0 36 12') + 'Se mueve</span>' +
        '<span>' + caja('<line x1="1" y1="6" x2="31" y2="6" stroke="' + NAVY +
          '" stroke-width="1.7" stroke-dasharray="6 4" marker-end="url(#' + marca + ')"/>', 36, 12, '0 0 36 12') + 'Pasa</span>' +
        '<span>' + caja(bote(marca, 2, 7, 31, 7), 36, 14, '0 0 36 14') + 'Bota</span>' +
        '</div>';
    }
  };

  window.PZ = PZ;
}());
