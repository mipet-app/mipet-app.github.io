// ═══════════════════════════════════════════════════════════════════
// KOLITA · PANTALLA DE INGRESO (reutilizable)
//
// Dibuja los dos pasos: escribe tu correo → escribe el código que te llegó.
// La usan registro.html, mis-carnets.html y editar.html para que el ingreso
// se vea y se comporte igual en las tres.
//
// Uso:
//   KolitaLogin.montar(document.getElementById('caja'), {
//     titulo: 'Entra a tus carnets',
//     subtitulo: 'Te enviamos un código a tu correo.',
//     crearSiNoExiste: false,
//     correoFijo: null,              // si se pasa, no deja cambiarlo
//     alEntrar: function(sesion){ ... }
//   });
// ═══════════════════════════════════════════════════════════════════
(function (global) {
  'use strict';

  var CSS = [
    '.kl-wrap{text-align:left;}',
    '.kl-ico{font-size:38px;text-align:center;}',
    '.kl-h{font-family:Fraunces,serif;font-size:21px;font-weight:700;text-align:center;margin-top:8px;}',
    '.kl-sub{font-size:12.5px;color:var(--mut);text-align:center;margin-top:6px;line-height:1.6;}',
    '.kl-lbl{display:block;font-size:11px;font-weight:800;color:var(--deep);text-transform:uppercase;letter-spacing:.8px;margin:18px 0 6px;}',
    '.kl-in{width:100%;padding:14px;border:1.5px solid var(--line);border-radius:13px;background:#fff;font-family:"Nunito Sans",sans-serif;font-size:15px;color:var(--ink);outline:none;transition:.2s;}',
    '.kl-in:focus{border-color:var(--mid);}',
    '.kl-code{text-align:center;font-size:24px;font-weight:800;letter-spacing:6px;font-family:Fraunces,serif;}',
    '.kl-btn{width:100%;padding:15px;border:none;border-radius:14px;font-family:"Nunito Sans",sans-serif;font-size:14.5px;font-weight:800;cursor:pointer;margin-top:16px;background:var(--mid);color:#fff;transition:.2s;}',
    '.kl-btn:hover{background:var(--deep);}',
    '.kl-btn:disabled{opacity:.55;cursor:default;}',
    '.kl-link{display:block;width:100%;background:none;border:none;color:var(--mut);font-size:12px;font-weight:800;margin-top:14px;cursor:pointer;font-family:"Nunito Sans",sans-serif;text-align:center;}',
    '.kl-err{background:#FDF7F3;border:1.5px solid #EAD4C9;color:#B0603F;border-radius:13px;padding:12px 14px;font-size:12.5px;font-weight:700;line-height:1.55;margin-top:14px;display:none;}',
    '.kl-err.show{display:block;}',
    '.kl-sent{background:var(--soft);border-radius:13px;padding:12px 14px;font-size:12.5px;color:var(--deep);font-weight:700;line-height:1.55;margin-top:14px;}',
    '.kl-note{font-size:11.5px;color:var(--mut);font-weight:600;line-height:1.6;margin-top:16px;background:var(--soft);border-radius:14px;padding:13px 15px;}'
  ].join('');

  function inyectarCSS() {
    if (document.getElementById('kl-css')) return;
    var s = document.createElement('style');
    s.id = 'kl-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function el(tag, cls, txt) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  }

  function montar(contenedor, opts) {
    inyectarCSS();
    opts = opts || {};
    var A = global.KolitaAuth;
    var correoEnCurso = opts.correoFijo ? A.limpiarCorreo(opts.correoFijo) : null;

    contenedor.innerHTML = '';
    var wrap = el('div', 'kl-wrap');

    wrap.appendChild(el('div', 'kl-ico', opts.icono || '🔒'));
    wrap.appendChild(el('h1', 'kl-h', opts.titulo || 'Confirma que eres tú'));
    var sub = el('p', 'kl-sub', opts.subtitulo || 'Te enviamos un código a tu correo.');
    wrap.appendChild(sub);

    var err = el('div', 'kl-err');
    var pasoCorreo = el('div');
    var pasoCodigo = el('div');
    pasoCodigo.style.display = 'none';

    function mostrarError(msg) {
      err.textContent = msg;
      err.classList.add('show');
    }
    function limpiarError() { err.classList.remove('show'); }

    // ── Paso 1: correo ──
    var lblC = el('label', 'kl-lbl', 'Tu correo');
    var inC = el('input', 'kl-in');
    inC.type = 'email';
    inC.placeholder = 'tucorreo@gmail.com';
    inC.autocomplete = 'email';
    inC.inputMode = 'email';
    if (correoEnCurso) { inC.value = correoEnCurso; inC.readOnly = true; }
    var btnC = el('button', 'kl-btn', 'Enviarme el código 🐾');

    pasoCorreo.appendChild(lblC);
    pasoCorreo.appendChild(inC);
    pasoCorreo.appendChild(btnC);
    if (opts.nota) pasoCorreo.appendChild(el('p', 'kl-note', opts.nota));

    // ── Paso 2: código ──
    var avisoEnviado = el('div', 'kl-sent');
    var lblK = el('label', 'kl-lbl', 'Código del correo');
    var inK = el('input', 'kl-in kl-code');
    inK.type = 'text';
    inK.inputMode = 'numeric';
    inK.autocomplete = 'one-time-code';
    // El largo lo decide Supabase (6 a 10). No lo damos por hecho.
    inK.maxLength = global.KolitaAuth.CODIGO_MAX;
    inK.placeholder = '••••••';
    var btnK = el('button', 'kl-btn', 'Entrar 🐾');
    var btnOtro = el('button', 'kl-link', '← Usar otro correo / reenviar');

    pasoCodigo.appendChild(avisoEnviado);
    pasoCodigo.appendChild(lblK);
    pasoCodigo.appendChild(inK);
    pasoCodigo.appendChild(btnK);
    pasoCodigo.appendChild(btnOtro);

    wrap.appendChild(pasoCorreo);
    wrap.appendChild(pasoCodigo);
    wrap.appendChild(err);
    contenedor.appendChild(wrap);

    // ── Acciones ──
    async function enviar() {
      limpiarError();
      var correo = correoEnCurso || inC.value;
      btnC.disabled = true;
      btnC.textContent = 'Enviando…';
      var r = await A.enviarCodigo(correo, opts.crearSiNoExiste);
      btnC.disabled = false;
      btnC.textContent = 'Enviarme el código 🐾';
      if (!r.ok) {
        mostrarError(r.error);
        if (r.noExiste && opts.alNoExistir) opts.alNoExistir();
        return;
      }
      correoEnCurso = r.email;
      avisoEnviado.textContent = '📬 Te enviamos un código a ' + r.email +
        '. Puede tardar un minuto; si no aparece, mira en Correo no deseado.';
      pasoCorreo.style.display = 'none';
      pasoCodigo.style.display = 'block';
      sub.textContent = 'Escribe el código que te llegó al correo.';
      inK.value = '';
      inK.focus();
    }

    async function confirmar() {
      clearTimeout(temporizador);   // si le diste al botón, no lo mandes dos veces
      if (btnK.disabled) return;
      limpiarError();
      btnK.disabled = true;
      btnK.textContent = 'Comprobando…';
      var r = await A.confirmarCodigo(correoEnCurso, inK.value);
      btnK.disabled = false;
      btnK.textContent = 'Entrar 🐾';
      if (!r.ok) { mostrarError(r.error); inK.select(); return; }
      if (opts.alEntrar) opts.alEntrar(r.session, r.user);
    }

    btnC.onclick = enviar;
    btnK.onclick = confirmar;
    btnOtro.onclick = function () {
      limpiarError();
      pasoCodigo.style.display = 'none';
      pasoCorreo.style.display = 'block';
      sub.textContent = opts.subtitulo || 'Te enviamos un código a tu correo.';
      if (!opts.correoFijo) { correoEnCurso = null; inC.focus(); }
    };
    inC.onkeydown = function (e) { if (e.key === 'Enter') enviar(); };
    inK.onkeydown = function (e) { if (e.key === 'Enter') confirmar(); };
    // Se envía solo cuando dejas de escribir, no al llegar a un largo fijo:
    // así funciona igual con códigos de 6 o de 8. Escribir un dígito más
    // cancela el envío anterior, de modo que no se manda a medias.
    var temporizador = null;
    inK.oninput = function () {
      this.value = this.value.replace(/\D/g, '').slice(0, global.KolitaAuth.CODIGO_MAX);
      clearTimeout(temporizador);
      if (this.value.length >= global.KolitaAuth.CODIGO_MIN) {
        temporizador = setTimeout(confirmar, 700);
      }
    };

    setTimeout(function () { (correoEnCurso ? btnC : inC).focus(); }, 60);
    return { enviar: enviar };
  }

  global.KolitaLogin = { montar: montar };
})(window);
