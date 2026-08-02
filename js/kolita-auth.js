// ═══════════════════════════════════════════════════════════════════
// KOLITA · INGRESO CON CORREO
//
// Kolita no usa contraseñas. Para entrar, te llega un código de 6 dígitos
// al correo y lo escribes. Quien tiene el correo, es el dueño: esa es toda
// la cerradura, y es la misma que usan los bancos para confirmar quién eres.
//
// Antes no había ninguna: bastaba con saber el correo o el celular de una
// familia — datos que cualquiera puede conocer — para cambiar el carnet de
// su peludo o apagarle el modo perdido.
//
// Este archivo lo usan registro.html, mis-carnets.html y editar.html.
// ═══════════════════════════════════════════════════════════════════
(function (global) {
  'use strict';

  var SUPABASE_URL = 'https://fdwbstqxqdailyeedmuo.supabase.co';
  var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZkd2JzdHF4cWRhaWx5ZWVkbXVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5MDEwMDEsImV4cCI6MjA5OTQ3NzAwMX0.GG6O9z1Exu5z0DsM8Fzk-fx1h2BIII0I9flMVZiPwIw';

  if (!global.supabase || !global.supabase.createClient) {
    console.error('Kolita: no cargó la librería de Supabase.');
    return;
  }

  var client = global.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // El código llega por correo y se escribe a mano, así que no hay
      // nada que leer de la dirección del navegador.
      detectSessionInUrl: false
    }
  });

  // ── Utilidades ───────────────────────────────────────────────────
  function correoValido(v) {
    return /^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$/.test(String(v || '').trim());
  }

  function limpiarCorreo(v) {
    return String(v || '').trim().toLowerCase();
  }

  // Traduce los errores de Supabase a algo que una persona entienda.
  function mensajeDeError(err) {
    var m = String((err && err.message) || err || '').toLowerCase();
    if (m.indexOf('rate limit') !== -1 || m.indexOf('too many') !== -1) {
      return 'Pediste varios códigos muy seguido. Espera un minuto e intenta de nuevo.';
    }
    if (m.indexOf('expired') !== -1) {
      return 'Ese código ya venció. Pide uno nuevo.';
    }
    if (m.indexOf('invalid') !== -1 || m.indexOf('token') !== -1) {
      return 'Ese código no coincide. Revisa los 6 dígitos del correo.';
    }
    if (m.indexOf('fetch') !== -1 || m.indexOf('network') !== -1) {
      return 'No pudimos conectar. Revisa tu internet e intenta de nuevo.';
    }
    return 'Algo salió mal. Intenta de nuevo en un momento.';
  }

  // ── Sesión ───────────────────────────────────────────────────────
  async function sesionActual() {
    try {
      var r = await client.auth.getSession();
      return (r && r.data && r.data.session) || null;
    } catch (e) {
      return null;
    }
  }

  async function correoDeSesion() {
    var s = await sesionActual();
    return (s && s.user && s.user.email) || null;
  }

  async function salir() {
    try { await client.auth.signOut(); } catch (e) { /* da igual */ }
  }

  // ── Enviar y confirmar el código ─────────────────────────────────
  // crearSiNoExiste: true en registro (la cuenta nace ahí),
  //                  false al entrar (no queremos crear cuentas fantasma
  //                  con correos mal escritos).
  async function enviarCodigo(correo, crearSiNoExiste) {
    var email = limpiarCorreo(correo);
    if (!correoValido(email)) {
      return { ok: false, error: 'Escribe un correo válido, por ejemplo tucorreo@gmail.com' };
    }
    try {
      var r = await client.auth.signInWithOtp({
        email: email,
        options: { shouldCreateUser: crearSiNoExiste !== false }
      });
      if (r.error) {
        var m = String(r.error.message || '').toLowerCase();
        // Con shouldCreateUser:false, un correo desconocido responde así.
        if (m.indexOf('signups not allowed') !== -1 || m.indexOf('not found') !== -1) {
          return { ok: false, error: 'No encontramos una cuenta con ese correo. ¿Quieres crear el carnet de tu peludo?', noExiste: true };
        }
        return { ok: false, error: mensajeDeError(r.error) };
      }
      return { ok: true, email: email };
    } catch (e) {
      return { ok: false, error: mensajeDeError(e) };
    }
  }

  // El largo del código lo decide Supabase (se puede configurar entre 6 y 10),
  // así que aquí NO se da por hecho. Al principio esta función exigía 6 justos
  // y rechazaba los códigos de 8 antes siquiera de preguntarle al servidor.
  var CODIGO_MIN = 6;
  var CODIGO_MAX = 10;

  async function confirmarCodigo(correo, codigo) {
    var email = limpiarCorreo(correo);
    var token = String(codigo || '').replace(/\D/g, '');
    if (token.length < CODIGO_MIN || token.length > CODIGO_MAX) {
      return { ok: false, error: 'Escribe el código completo tal como llegó al correo.' };
    }
    try {
      var r = await client.auth.verifyOtp({ email: email, token: token, type: 'email' });
      if (r.error) return { ok: false, error: mensajeDeError(r.error) };
      return { ok: true, session: r.data.session, user: r.data.user };
    } catch (e) {
      return { ok: false, error: mensajeDeError(e) };
    }
  }

  // ── Reclamar los carnets que ya existían ─────────────────────────
  // Enlaza a esta cuenta los carnets creados antes de que Kolita tuviera
  // ingreso, comparando contra el correo YA confirmado. Por eso enlazar
  // sigue exigiendo abrir el correo: no es un atajo.
  async function reclamarCarnets() {
    try {
      var r = await client.rpc('claim_pets');
      if (r.error) { console.warn('claim_pets:', r.error.message); return 0; }
      return r.data || 0;
    } catch (e) {
      console.warn('claim_pets falló', e);
      return 0;
    }
  }

  global.KolitaAuth = {
    client: client,
    SUPABASE_URL: SUPABASE_URL,
    SUPABASE_KEY: SUPABASE_KEY,
    correoValido: correoValido,
    limpiarCorreo: limpiarCorreo,
    CODIGO_MIN: CODIGO_MIN,
    CODIGO_MAX: CODIGO_MAX,
    sesionActual: sesionActual,
    correoDeSesion: correoDeSesion,
    salir: salir,
    enviarCodigo: enviarCodigo,
    confirmarCodigo: confirmarCodigo,
    reclamarCarnets: reclamarCarnets,
    mensajeDeError: mensajeDeError
  };
})(window);
