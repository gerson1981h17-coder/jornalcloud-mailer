const express = require('express');
const cors    = require('cors');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '5mb' }));

if (!process.env.BREVO_API_KEY) {
  console.error('❌ FALTA VARIABLE DE ENTORNO: BREVO_API_KEY');
  process.exit(1);
}

console.log('✅ JornalCloud Mailer listo con Brevo');

app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'JornalCloud Mailer', time: new Date().toISOString() });
});

app.post('/send', async (req, res) => {
  const { to, subject, html, text, from_name, attachment } = req.body;

  if (!to)            return res.status(400).json({ ok: false, error: 'Falta el destinatario (to)' });
  if (!subject)       return res.status(400).json({ ok: false, error: 'Falta el asunto (subject)' });
  if (!html && !text) return res.status(400).json({ ok: false, error: 'Falta el cuerpo del correo' });

  const destinatarios = to.split(',').map(e => e.trim()).filter(Boolean);
  const senderName = from_name || 'JornalCloud';

  try {
    const payload = {
      from:    `${senderName} <onboarding@resend.dev>`,
      to:      destinatarios,
      subject: subject,
      html:    html || `<pre style="font-family:sans-serif;white-space:pre-wrap">${text}</pre>`,
      text:    text || '',
    };

    // Adjuntar PDF si viene en la petición
    if (attachment && attachment.data && attachment.filename) {
      payload.attachments = [{
        filename: attachment.filename,
        content:  attachment.data,
      }];
      console.log(`📎 Adjunto: ${attachment.filename} (${Math.round(attachment.data.length/1024)}KB)`);
    }

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': process.env.BREVO_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender:   { name: senderName, email: 'gerson1981h17@gmail.com' },
        to:       destinatarios.map(e => ({ email: e })),
        subject:  subject,
        htmlContent: html || `<pre style="font-family:sans-serif;white-space:pre-wrap">${text}</pre>`,
        textContent: text || subject || 'Parte de jornales adjunto.',
        ...(payload.attachments ? {
          attachment: payload.attachments.map(a => ({
            name:    a.filename,
            content: a.content,
          }))
        } : {})
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
