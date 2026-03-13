const express = require('express');
const cors    = require('cors');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '5mb' }));

if (!process.env.RESEND_API_KEY) {
  console.error('❌ FALTA VARIABLE DE ENTORNO: RESEND_API_KEY');
  process.exit(1);
}

console.log('✅ JornalCloud Mailer listo con Resend');

app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'JornalCloud Mailer', time: new Date().toISOString() });
});

app.post('/send', async (req, res) => {
  const { to, subject, html, text, from_name } = req.body;

  if (!to)            return res.status(400).json({ ok: false, error: 'Falta el destinatario (to)' });
  if (!subject)       return res.status(400).json({ ok: false, error: 'Falta el asunto (subject)' });
  if (!html && !text) return res.status(400).json({ ok: false, error: 'Falta el cuerpo del correo' });

  const destinatarios = to.split(',').map(e => e.trim()).filter(Boolean);
  const senderName = from_name || 'JornalCloud';

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from:    `${senderName} <onboarding@resend.dev>`,
        to:      destinatarios,
        subject: subject,
        html:    html || `<pre style="font-family:sans-serif;white-space:pre-wrap">${text}</pre>`,
        text:    text || '',
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Error Resend:', data);
      return res.status(500).json({ ok: false, error: data.message || 'Error enviando' });
    }

    console.log(`📨 Enviado → ${destinatarios.join(', ')} | ID: ${data.id}`);
    res.json({ ok: true, messageId: data.id, to: destinatarios });

  } catch (err) {
    console.error('❌ Error:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Escuchando en puerto ${PORT}`);
});
