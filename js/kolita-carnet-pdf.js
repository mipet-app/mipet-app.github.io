// ═══════════════════════════════════════════════════════════════════
// KOLITA · CARNET PLEGABLE EN PDF (tres cuerpos, doble cara)
//
// Diseño aprobado el 25 de septiembre de 2026 con Mario: hoja A4
// horizontal que se dobla en tres como el carnet de veterinaria, con
// casillas para pegar la etiqueta de cada vacuna.
//
// Se dibuja en el navegador a 300 ppp con las letras de la marca
// (Fraunces y Nunito Sans) y se descarga como PDF. No se sube nada a
// ningún servidor. El celular de la familia NO se imprime: quien lo
// encuentre avisa escaneando el QR.
//
// Uso:
//   var faltan = KolitaCarnetPDF.faltantes(pet);   // [] si está completo
//   await KolitaCarnetPDF.descargar(pet);
// Lo usan mis-carnets.html y editar.html.
// ═══════════════════════════════════════════════════════════════════
(function (global) {
  'use strict';

  var LIB_PDF = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
  var LIB_QR  = 'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js';
  var BASE_QR = 'https://kolita.co/p/?c=';
  var LOGO    = 'logo-kolita.png';
  var LOGO_RECORTE = [545, 262, 445, 431];   // zona visible del logo dentro del PNG

  // ── Paleta del carnet (la misma del diseño aprobado) ───────────────
  var CREMA = '#FBFCFA', BRUMA = '#EEF3E9', SALVIA = '#718B61', BOSQUE = '#3F5737',
      TINTA = '#293827', MUTADO = '#7F8D7B', LINEA = '#E1E8DE', TERRA = '#C87B5B',
      TERRA_BG = '#FBF3EF', BLANCO = '#FFFFFF', DOBLEZ = '#D7DFD3';

  // ── Campos obligatorios para poder descargar ───────────────────────
  var OBLIGATORIOS = [
    ['photo_url',   'la foto'],
    ['name',        'el nombre'],
    ['species',     'la especie'],
    ['breed',       'la raza'],
    ['sex',         'el sexo'],
    ['birth_date',  'la fecha de nacimiento'],
    ['weight',      'el peso'],
    ['allergies',   'las alergias (o marcar que no tiene)'],
    ['owner_name',  'tu nombre']
  ];
  function faltantes(p) {
    return OBLIGATORIOS.filter(function (c) {
      var v = p && p[c[0]];
      if (Array.isArray(v)) return v.filter(function (x) { return String(x || '').trim(); }).length === 0;
      return v === null || v === undefined || String(v).trim() === '';
    }).map(function (c) { return c[1]; });
  }

  // ── Medidas: todo en milímetros, con el origen abajo a la izquierda ──
  var W = 297, H = 210, PANEL = 99, MX = 8, MT = 13, MB = 11, CW = PANEL - 2 * MX;
  var K = 300 / 25.4;                 // píxeles por milímetro a 300 ppp
  var PT = 25.4 / 72;                 // un punto tipográfico en mm
  var ctx;

  var FUENTES = {
    Titulo:  ['600', 'Fraunces, Georgia, serif'],
    Cuerpo:  ['400', '"Nunito Sans", Arial, sans-serif'],
    CuerpoM: ['600', '"Nunito Sans", Arial, sans-serif'],
    CuerpoB: ['800', '"Nunito Sans", Arial, sans-serif'],
    Marca:   ['700', 'Quicksand, "Nunito Sans", sans-serif']
  };
  function fuente(f, size) { var d = FUENTES[f] || FUENTES.Cuerpo; return d[0] + ' ' + (size * PT * K) + 'px ' + d[1]; }
  function X(x) { return x * K; }
  function Y(y) { return (H - y) * K; }

  function ancho(txt, f, size, track) {
    ctx.font = fuente(f, size);
    return ctx.measureText(txt).width / K + (track || 0) * PT * Math.max(0, txt.length - 1);
  }

  // Texto. Si no cabe en maxw, se achica (hasta 70 %) y si aún no cabe, se corta con "…".
  function T(txt, x, y, f, size, color, align, maxw, track) {
    txt = String(txt == null ? '' : txt); f = f || 'Cuerpo'; size = size || 8; track = track || 0;
    if (maxw) {
      var s = size;
      while (ancho(txt, f, s, track) > maxw && s > size * 0.7) s -= 0.2;
      size = s;
      while (ancho(txt, f, size, track) > maxw && txt.length > 2) txt = txt.slice(0, -2) + '…';
    }
    var w = ancho(txt, f, size, track);
    var x0 = align === 'c' ? x - w / 2 : (align === 'r' ? x - w : x);
    ctx.font = fuente(f, size); ctx.fillStyle = color || TINTA; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    if (!track) { ctx.fillText(txt, X(x0), Y(y)); return w; }
    var cx = X(x0), esp = track * PT * K;
    for (var i = 0; i < txt.length; i++) { ctx.fillText(txt[i], cx, Y(y)); cx += ctx.measureText(txt[i]).width + esp; }
    return w;
  }
  function parrafo(txt, x, y, maxw, f, size, color, leading, align) {
    f = f || 'Cuerpo'; size = size || 7; leading = (leading || 9.6) * PT;
    var palabras = String(txt).split(/\s+/), linea = '', lineas = [];
    palabras.forEach(function (p) {
      var prueba = (linea + ' ' + p).trim();
      if (ancho(prueba, f, size) <= maxw) linea = prueba;
      else { if (linea) lineas.push(linea); linea = p; }
    });
    if (linea) lineas.push(linea);
    var anc = align === 'c' ? x + maxw / 2 : (align === 'r' ? x + maxw : x);
    lineas.forEach(function (ln) { T(ln, anc, y, f, size, color, align, maxw); y -= leading; });
    return y;
  }
  function kicker(txt, x, y, color, size, maxw) { T(String(txt).toUpperCase(), x, y, 'CuerpoB', size || 5.6, color || MUTADO, 'l', maxw, 1.1); }
  function titulo(txt, x, y, size, color, align, maxw) { T(txt, x, y, 'Titulo', size || 14, color || BOSQUE, align || 'l', maxw); }
  function linea(x1, y1, x2, y2, color, grosor, dash) {
    ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = (grosor || 0.6) * PT * K;
    ctx.setLineDash(dash ? dash.map(function (d) { return d * PT * K; }) : []);
    ctx.moveTo(X(x1), Y(y1)); ctx.lineTo(X(x2), Y(y2)); ctx.stroke(); ctx.setLineDash([]);
  }
  function regla(x, y, w, color, grosor) { linea(x, y, x + w, y, color || LINEA, grosor || 0.6); }
  function rutaRedonda(x, y, w, h, r) {
    var a = X(x), b = Y(y + h), ww = w * K, hh = h * K, rr = r * K;
    ctx.beginPath();
    ctx.moveTo(a + rr, b); ctx.arcTo(a + ww, b, a + ww, b + hh, rr); ctx.arcTo(a + ww, b + hh, a, b + hh, rr);
    ctx.arcTo(a, b + hh, a, b, rr); ctx.arcTo(a, b, a + ww, b, rr); ctx.closePath();
  }
  function caja(x, y, w, h, relleno, borde, r, grosor, dash) {
    rutaRedonda(x, y, w, h, r == null ? 3 : r);
    if (relleno) { ctx.fillStyle = relleno; ctx.fill(); }
    if (borde) {
      ctx.strokeStyle = borde; ctx.lineWidth = (grosor || 0.7) * PT * K;
      ctx.setLineDash(dash ? dash.map(function (d) { return d * PT * K; }) : []); ctx.stroke(); ctx.setLineDash([]);
    }
  }
  function rect(x, y, w, h, relleno) { ctx.fillStyle = relleno; ctx.fillRect(X(x), Y(y + h), w * K, h * K); }
  function campo(etiqueta, valor, x, y, maxw) {
    kicker(etiqueta, x, y, MUTADO, 5.4, maxw);
    if (valor) T(valor, x, y - 6.6 * 0.72, 'CuerpoM', 8.6, TINTA, 'l', maxw);
    regla(x, y - 7.2, maxw);
    return y - 12.2;
  }
  function lineasEscribir(x, y, maxw, n, paso) {
    for (var i = 0; i < (n || 3); i++) { linea(x, y, x + maxw, y, LINEA, 0.6, [1.4, 1.8]); y -= (paso || 7.4); }
    return y;
  }
  function dobleces() { [1, 2].forEach(function (i) { linea(i * PANEL, 4, i * PANEL, H - 4, DOBLEZ, 0.5, [2, 3]); }); }
  function qr(url, x, y, tam) {
    var q = global.qrcode(0, 'M'); q.addData(url); q.make();
    var n = q.getModuleCount(), m = tam / n;
    rect(x, y, tam, tam, BLANCO);
    ctx.fillStyle = TINTA;
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++)
      if (q.isDark(r, c)) ctx.fillRect(Math.floor(X(x + c * m)), Math.floor(Y(y + tam - r * m)), Math.ceil(m * K), Math.ceil(m * K));
  }

  // ── Datos con formato ──────────────────────────────────────────────
  var MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  function fecha(iso) {
    if (!iso) return '';
    var p = String(iso).slice(0, 10).split('-');
    return (+p[2]) + ' de ' + MESES[+p[1] - 1] + ' de ' + p[0];
  }
  function hoy() { var d = new Date(); return d.getDate() + ' de ' + MESES[d.getMonth()] + ' de ' + d.getFullYear(); }
  function cap(s) { s = String(s || '').trim(); return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }
  function bonitoNombre(n) {
    var s = String(n || '').trim();
    if (s && s === s.toUpperCase()) s = s.toLowerCase().replace(/(^|\s)(\S)/g, function (_m, a, b) { return a + b.toUpperCase(); });
    return s;
  }
  function datos(p) {
    var al = (Array.isArray(p.allergies) ? p.allergies : []).filter(Boolean);
    return {
      nombre: bonitoNombre(p.name),
      subtitulo: [cap(p.breed), cap(p.sex)].filter(Boolean).join(' · '),
      codigo: p.short_code || '',
      url: p.short_code ? BASE_QR + p.short_code : 'https://kolita.co/perfil.html?id=' + encodeURIComponent(p.id),
      responsable: p.owner_name || '',
      ciudad: p.vet_city || '',
      vet: p.vet_name || '',
      vet_tel: p.vet_phone || '',
      alergias: al.length ? al.join(', ') : 'Ninguna conocida',
      especie: cap(p.species), raza: cap(p.breed), sexo: cap(p.sex),
      nacimiento: fecha(p.birth_date),
      peso: p.weight ? String(p.weight).replace('.', ',') + ' kg' : ''
    };
  }

  function cargarScript(src) {
    return new Promise(function (ok, mal) {
      if (document.querySelector('script[data-k="' + src + '"]')) return ok();
      var s = document.createElement('script');
      s.src = src; s.async = true; s.setAttribute('data-k', src);
      s.onload = ok; s.onerror = function () { mal(new Error('No cargó ' + src)); };
      document.head.appendChild(s);
    });
  }
  async function imagen(url) {
    if (!url) return null;
    try {
      var r = await fetch(url, { mode: 'cors' });
      if (!r.ok) return null;
      return await createImageBitmap(await r.blob());
    } catch (e) { return null; }
  }
  function lienzo() {
    var cv = document.createElement('canvas');
    cv.width = Math.round(W * K); cv.height = Math.round(H * K);
    ctx = cv.getContext('2d');
    rect(0, 0, W, H, CREMA);
    return cv;
  }

  // ═════════════════ CARA EXTERIOR ═════════════════
  function exterior(d, foto, logo) {
    var cv = lienzo(); dobleces();
    var x, y, cx;

    // Cuerpo 1: la familia
    x = MX; y = H - MT;
    kicker('Kolita · carnet digital', x, y, SALVIA, 5.6, CW); y -= 8;
    titulo('Su familia', x, y, 15, BOSQUE, 'l', CW); y -= 9;
    y = campo('Responsable', d.responsable, x, y, CW);
    y = campo('Ciudad', d.ciudad, x, y, CW);
    caja(x, y - 14.5, CW, 15.5, BRUMA, LINEA);
    kicker('Cómo contactarnos', x + 4.5, y - 4.6, BOSQUE, 5.4, CW - 9);
    parrafo('Escanea el código QR del respaldo. El aviso le llega a la familia y su número de celular no queda a la vista.',
      x + 4.5, y - 9.4, CW - 9, 'Cuerpo', 6.4, MUTADO, 8.6);
    y -= 22;
    regla(x, y, CW); y -= 9;
    titulo('Su veterinario', x, y, 13, BOSQUE, 'l', CW); y -= 8.5;
    y = campo('Nombre o clínica', d.vet, x, y, CW);
    y = campo('Teléfono', d.vet_tel, x, y, CW);
    regla(x, y, CW); y -= 8.5;
    titulo('Alergias', x, y, 13, TERRA, 'l', CW); y -= 5;
    caja(x, y - 10, CW, 12, TERRA_BG, '#EAD4C9');
    T(d.alergias, x + 4.5, y - 5, 'CuerpoM', 8.4, TERRA, 'l', CW - 9);
    y -= 15;
    kicker('Otro contacto de la familia', x, y, MUTADO, 5.2, CW); y -= 5;
    y = lineasEscribir(x, y, CW, 2, 6.4);
    kicker('Guardería, paseador o quien lo cuida', x, y, MUTADO, 5.2, CW); y -= 5;
    lineasEscribir(x, y, CW, 2, 6.4);
    regla(x, MB + 15, CW);
    T('Carnet impreso el', x, MB + 8, 'CuerpoM', 7, MUTADO, 'l', 30);
    T(hoy(), x + 30, MB + 8, 'CuerpoM', 7, TINTA, 'l', CW - 30);

    // Cuerpo 2: el QR
    rect(PANEL, 0, PANEL, H, BRUMA);
    x = PANEL + MX; cx = PANEL + PANEL / 2;
    T('ESCANÉAME SI ME PERDÍ', cx, H - MT - 3, 'CuerpoB', 10.2, BOSQUE, 'c', CW);
    var qs = 52, ty = H - MT - 12 - (qs + 10);
    caja(cx - (qs + 10) / 2, ty, qs + 10, qs + 10, BLANCO, LINEA, 5);
    qr(d.url, cx - qs / 2, ty + 5, qs);
    y = ty - 9;
    T('kolita.co/p', cx, y, 'CuerpoM', 8, MUTADO, 'c', CW); y -= 11;
    caja(cx - 34, y - 3, 68, 13, BOSQUE, BOSQUE, 4);
    T(d.codigo, cx, y + 1.2, 'CuerpoB', 13, CREMA, 'c', 62, 2); y -= 9;
    T('CÓDIGO KOLITA', cx, y - 2, 'CuerpoB', 5.6, MUTADO, 'c', CW, 1.2); y -= 13;
    y = parrafo('Quien lo encuentre escanea este código y ve su carnet. Para avisar, primero dice quién es y dónde lo vio; ese aviso llega a nuestro correo.',
      x, y, CW, 'Cuerpo', 7, MUTADO, 10, 'c');
    y -= 3;
    parrafo('Si no abre, escribe a appmipet@gmail.com', x, y, CW, 'Cuerpo', 6.4, MUTADO, 9, 'c');
    var th = 38, tyy = MB + 13;
    caja(x, tyy, CW, th, BLANCO, LINEA);
    T('¿Encontraste a este peludo?', cx, tyy + th - 8, 'CuerpoB', 8.4, BOSQUE, 'c', CW - 8);
    var pasos = ['Escanea el código de arriba con la cámara.',
                 'Cuéntale a la familia quién eres y dónde lo viste.',
                 'Si puedes, quédate cerca de él mientras llegan.'];
    var py = tyy + th - 15.5;
    pasos.forEach(function (paso, i) {
      ctx.fillStyle = SALVIA; ctx.beginPath(); ctx.arc(X(x + 6.5), Y(py + 1.1), 2.4 * K, 0, Math.PI * 2); ctx.fill();
      T(String(i + 1), x + 6.5, py - 0.6, 'CuerpoB', 6, CREMA, 'c', 5);
      parrafo(paso, x + 11.5, py, CW - 15, 'Cuerpo', 6.8, TINTA, 8.4);
      py -= 10;
    });
    regla(x, MB + 7, CW, DOBLEZ);
    T('Carnet digital gratis · kolita.co', cx, MB, 'CuerpoM', 7, SALVIA, 'c', CW);

    // Cuerpo 3: portada
    x = 2 * PANEL + MX; cx = 2 * PANEL + PANEL / 2;
    var bh = 52;
    rect(2 * PANEL, H - bh, PANEL, bh, BOSQUE);
    // Logo real + nombre de la marca
    var ls = 15, lx = cx - 19, ly = H - bh + 28;
    if (logo) {
      caja(lx - 0.8, ly - 0.8, ls + 1.6, ls + 1.6, CREMA, null, 4.4);
      ctx.save(); rutaRedonda(lx, ly, ls, ls, 3.8); ctx.clip();
      ctx.drawImage(logo, LOGO_RECORTE[0], LOGO_RECORTE[1], LOGO_RECORTE[2], LOGO_RECORTE[3], X(lx), Y(ly + ls), ls * K, ls * K);
      ctx.restore();
    }
    T('kolita', lx + ls + 4, ly + 4.2, 'Marca', 20, CREMA, 'l', 30);
    T('CARNET DE IDENTIFICACIÓN Y SALUD', cx, H - bh + 17, 'CuerpoM', 6.2, '#C9DAC4', 'c', CW, 1.1);
    // Foto
    var fs = 50, fy = H - bh - fs / 2 - 3;
    caja(cx - fs / 2 - 1.6, fy - 1.6, fs + 3.2, fs + 3.2, CREMA, CREMA, 8, 3);
    caja(cx - fs / 2, fy, fs, fs, BRUMA, LINEA, 7);
    if (foto) {
      ctx.save(); rutaRedonda(cx - fs / 2, fy, fs, fs, 7); ctx.clip();
      var esc = Math.max(fs * K / foto.width, fs * K / foto.height);
      var dw = foto.width * esc, dh = foto.height * esc;
      ctx.drawImage(foto, X(cx - fs / 2) + (fs * K - dw) / 2, Y(fy + fs) + (fs * K - dh) / 2, dw, dh);
      ctx.restore();
    } else {
      T('FOTO DEL PELUDO', cx, fy + fs / 2 - 1, 'CuerpoB', 6, MUTADO, 'c', fs - 6, 1);
    }
    y = fy - 14;
    titulo(d.nombre.toUpperCase(), cx, y, 27, BOSQUE, 'c', CW); y -= 8;
    T(d.subtitulo, cx, y, 'CuerpoM', 8.4, MUTADO, 'c', CW); y -= 11;
    caja(cx - 32, y - 3.5, 64, 11, BRUMA, LINEA, 4);
    T('Código  ' + d.codigo, cx, y, 'CuerpoB', 8.6, BOSQUE, 'c', 58, 0.8);
    var bqh = 44, bqy = MB + 13;
    caja(x, bqy, CW, bqh, BRUMA, LINEA);
    T('LO QUE LLEVA ADENTRO', cx, bqy + bqh - 9, 'CuerpoB', 5.8, BOSQUE, 'c', CW - 8, 1.1);
    var iy = bqy + bqh - 17;
    ['Sus datos y sus señas particulares', 'Sus vacunas, con espacio para la etiqueta',
     'Su desparasitación y las notas del veterinario'].forEach(function (it) {
      T('·', x + 6, iy, 'CuerpoB', 8, SALVIA, 'l', 3);
      parrafo(it, x + 10, iy, CW - 14, 'Cuerpo', 6.8, TINTA, 8.4);
      iy -= 8.6;
    });
    T('Hecho en Medellín, Colombia', cx, MB, 'CuerpoM', 6.6, MUTADO, 'c', CW);
    return cv;
  }

  // ═════════════════ CARA INTERIOR ═════════════════
  function interior(d) {
    var cv = lienzo(); dobleces();
    var x, y;

    // Cuerpo 1: datos del peludo
    x = MX; y = H - MT;
    kicker('Cuerpo 1', x, y, SALVIA, 5.4, CW); y -= 8;
    titulo('Datos de ' + d.nombre, x, y, 15, BOSQUE, 'l', CW); y -= 9.5;
    var col = (CW - 5) / 2;
    [['Especie', d.especie, 'Raza', d.raza],
     ['Sexo', d.sexo, 'Color / pelaje', ''],
     ['Nacimiento', d.nacimiento, 'Peso', d.peso],
     ['Esterilizado', '', 'Código Kolita', d.codigo]].forEach(function (f) {
      var y0 = y;
      campo(f[0], f[1], x, y0, col);
      y = campo(f[2], f[3], x + col + 5, y0, col);
    });
    regla(x, y + 2, CW); y -= 6;
    titulo('Señas particulares', x, y, 12.5, BOSQUE, 'l', CW); y -= 4.5;
    parrafo('Manchas, cicatrices, un ojo de otro color, la oreja caída: lo que sirve para reconocerlo aunque venga sucio o trasquilado.',
      x, y, CW, 'Cuerpo', 6.4, MUTADO, 8.6);
    y -= 11;
    y = lineasEscribir(x, y, CW, 4);
    y -= 2;
    caja(x, y - 19, CW, 21, BRUMA, LINEA);
    kicker('Microchip', x + 4.5, y - 4.5, BOSQUE, 5.4, CW - 9);
    T('N.º', x + 4.5, y - 11, 'CuerpoM', 7.4, MUTADO, 'l', 10);
    linea(x + 13, y - 11.6, x + CW - 4.5, y - 11.6, LINEA, 0.6, [1.4, 1.8]);
    linea(x + 18, y - 16.6, x + CW - 4.5, y - 16.6, LINEA, 0.6, [1.4, 1.8]);
    T('Fecha', x + 4.5, y - 16, 'CuerpoM', 7.4, MUTADO, 'l', 13);
    y -= 27;
    titulo('Cirugías y tratamientos', x, y, 12.5, BOSQUE, 'l', CW); y -= 4.5;
    y = parrafo('Esterilización, operaciones, medicamentos que toma siempre.', x, y, CW, 'Cuerpo', 6.4, MUTADO, 8.6);
    y -= 4;
    lineasEscribir(x, y, CW, 4);
    T('kolita.co', x, MB, 'CuerpoB', 7, SALVIA, 'l', CW);

    // Cuerpo 2: vacunas
    x = PANEL + MX; y = H - MT;
    kicker('Cuerpo 2', x, y, SALVIA, 5.4, CW); y -= 8;
    titulo('Vacunas', x, y, 15, BOSQUE, 'l', CW); y -= 6;
    y = parrafo('Pega en cada casilla la etiqueta del frasco. Esa etiqueta es la prueba que piden las guarderías, los hoteles y las aerolíneas.',
      x, y, CW, 'Cuerpo', 6.6, MUTADO, 8.8);
    y -= 4;
    var fh = 22.5;
    for (var i = 0; i < 7; i++) {
      var yb = y - fh;
      caja(x, yb, CW, fh - 2.5, null, LINEA, 2.5);
      var lx = x + 3.5;
      kicker('Vacuna', lx, yb + fh - 8, MUTADO, 5, 26);
      linea(lx, yb + fh - 11.6, lx + 28, yb + fh - 11.6, LINEA, 0.6, [1.4, 1.8]);
      linea(lx, yb + fh - 17.4, lx + 28, yb + fh - 17.4, LINEA, 0.6, [1.4, 1.8]);
      kicker('Fecha', lx, yb + fh - 13.8, MUTADO, 5, 26);
      var ex = x + 34, ew = CW - 37.5;
      caja(ex, yb + 2.5, ew, fh - 7.5, null, '#C9D5C3', 2, 0.7, [2, 2.2]);
      T('ETIQUETA DEL FRASCO', ex + ew / 2, yb + fh / 2 - 1.6, 'CuerpoB', 5.2, '#B6C4B1', 'c', ew - 4, 0.9);
      y = yb;
    }
    T('kolita.co', x, MB, 'CuerpoB', 7, SALVIA, 'l', CW);

    // Cuerpo 3: desparasitación y notas
    x = 2 * PANEL + MX; y = H - MT;
    kicker('Cuerpo 3', x, y, SALVIA, 5.4, CW); y -= 8;
    titulo('Desparasitación', x, y, 15, BOSQUE, 'l', CW); y -= 6;
    y = parrafo('Interna y externa. Anota el producto y la dosis: sirve para no repetir el mismo principio activo dos veces seguidas.',
      x, y, CW, 'Cuerpo', 6.6, MUTADO, 8.8);
    y -= 5;
    var cols = [['Fecha', 19], ['Producto', 33], ['Peso', 13], ['Próxima', 18]];
    rect(x, y - 6.5, CW, 6.5, BRUMA);
    caja(x, y - 6.5, CW, 6.5, null, LINEA, 0, 0.6);
    var cxp = x + 2.2;
    cols.forEach(function (c) { kicker(c[0], cxp, y - 4.4, BOSQUE, 5, c[1] - 2); cxp += c[1]; });
    y -= 6.5;
    for (var j = 0; j < 7; j++) {
      caja(x, y - 8.6, CW, 8.6, null, LINEA, 0, 0.6);
      cxp = x;
      for (var k = 0; k < cols.length - 1; k++) { cxp += cols[k][1]; linea(cxp, y - 8.6, cxp, y, LINEA, 0.6); }
      y -= 8.6;
    }
    y -= 8;
    titulo('Notas del veterinario', x, y, 13, BOSQUE, 'l', CW); y -= 6;
    y = lineasEscribir(x, y, CW, 6, 7.2);
    y -= 1;
    caja(x, y - 14, CW, 15, BRUMA, LINEA);
    parrafo('Este carnet es el resumen que llevas contigo. Su carnet digital completo, con recordatorios de vacunas, vive en kolita.co y se actualiza cuando quieras.',
      x + 4.5, y - 4.8, CW - 9, 'Cuerpo', 6.4, MUTADO, 8.6);
    T('kolita.co', x, MB, 'CuerpoB', 7, SALVIA, 'l', CW);
    T('Código ' + d.codigo, 2 * PANEL + PANEL - MX, MB, 'CuerpoM', 6.6, MUTADO, 'r', 40);
    return cv;
  }

  // ═════════════════ PDF ═════════════════
  async function descargar(p) {
    var f = faltantes(p);
    if (f.length) throw new Error('Faltan datos: ' + f.join(', '));
    await Promise.all([cargarScript(LIB_PDF), cargarScript(LIB_QR)]);
    try {
      await Promise.all([
        document.fonts.load('600 40px Fraunces'), document.fonts.load('700 40px Quicksand'),
        document.fonts.load('400 20px "Nunito Sans"'), document.fonts.load('600 20px "Nunito Sans"'),
        document.fonts.load('800 20px "Nunito Sans"')
      ]);
    } catch (e) { /* si no cargan, usa letras del sistema */ }

    var d = datos(p);
    var res = await Promise.all([imagen(p.photo_url), imagen(LOGO)]);
    var ext = exterior(d, res[0], res[1]);
    var int = interior(d);

    var doc = new global.jspdf.jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape', compress: true });
    doc.setProperties({ title: 'Carnet Kolita — ' + d.nombre, author: 'Kolita', subject: 'Carnet plegable para imprimir' });
    doc.addImage(ext.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, W, H);
    doc.addPage('a4', 'landscape');
    doc.addImage(int.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, W, H);

    var archivo = 'carnet-kolita-' + d.nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.pdf';
    doc.save(archivo);
  }

  global.KolitaCarnetPDF = { descargar: descargar, faltantes: faltantes, _exterior: exterior, _interior: interior, _datos: datos };
})(window);
