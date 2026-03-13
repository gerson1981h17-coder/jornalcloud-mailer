const express    = require('express');
const nodemailer = require('nodemailer');
const cors       = require('cors');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '5mb' }));

// ── Validar variables de entorno al arrancar
if (!process.env.GMAIL_USER || !process.env.GMAIL_PASS) {
  console.error('❌ FALTAN VARIABLES DE ENTORNO: GMAIL_USER y GMAIL_PASS');
  console.error('   Ve a Render → Environment y añádelas.');
  process.exit(1);
}

// ── Transporter Gmail
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

// ── Verificar conexión al arrancar
transporter.verify((err) => {
  if (err) {
    console.error('❌ Error conectando con Gmail:', err.message);
    console.error('   Verifica que GMAIL_USER y GMAIL_PASS sean correctos.');
    console.error('   GMAIL_PASS debe ser una App Password de 16 caracteres, no tu contraseña normal.');
  } else {
    console.log('✅ JornalCloud Mailer listo');
    console.log('   Gmail conectado como:', process.env.GMAIL_USER);
  }
});

// ── GET / → salud del servidor (también sirve para el ping keep-alive)
app.get('/', (req, res) => {
  res.json({
    status:  'ok',
    service: 'JornalCloud Mailer',
    time:    new Date().toISOString()
  });
});

// ── POST /send → enviar correo
app.post('/send', async (req, res) => {
  const { to, subject, html, text, from_name } = req.body;

  if (!to)             return res.status(400).json({ ok: false, error: 'Falta el destinatario (to)' });
  if (!subject)        return res.status(400).json({ ok: false, error: 'Falta el asunto (subject)' });
  if (!html && !text)  return res.status(400).json({ ok: false, error: 'Falta el cuerpo del correo' });

  const destinatarios = to.split(',').map(e => e.trim()).filter(Boolean);
  const senderName = from_name || 'JornalCloud';
  const senderAddr = process.env.GMAIL_USER;

  try {
    const info = await transporter.sendMail({
      from:    `"${senderName}" <${senderAddr}>`,
      to:      destinatarios.join(', '),
      subject: subject,
      text:    text || '',
      html:    html || `<pre style="font-family:sans-serif;white-space:pre-wrap">${text}</pre>`,
    });

    console.log(`📨 Enviado → ${destinatarios.join(', ')} | ID: ${info.messageId}`);
    res.json({ ok: true, messageId: info.messageId, to: destinatarios });

  } catch (err) {
    console.error('❌ Error enviando:', err.message);

    let errorMsg = err.message;
    if (err.message.includes('Invalid login') || err.message.includes('535')) {
      errorMsg = 'Credenciales Gmail incorrectas. Verifica GMAIL_USER y GMAIL_PASS en Render.';
    } else if (err.message.includes('ECONNREFUSED') || err.message.includes('ENOTFOUND')) {
      errorMsg = 'No se puede conectar con Gmail. Comprueba la conexión del servidor.';
    }

    res.status(500).json({ ok: false, error: errorMsg });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Escuchando en puerto ${PORT}`);
});
