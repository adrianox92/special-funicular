import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import LegalDocumentLayout from '../components/LegalDocumentLayout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Alert, AlertDescription } from '../components/ui/alert';
import api from '../lib/axios';
import { toast } from 'sonner';

const Contact = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [submitting, setSubmitting] = useState(false);

  React.useEffect(() => {
    document.title = 'Contacto | Slot Collection Pro';
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/public/contact', {
        name: name.trim(),
        email: email.trim(),
        message: message.trim(),
        website: honeypot,
      });
      toast.success('Mensaje enviado. Te responderemos cuando podamos.');
      setName('');
      setEmail('');
      setMessage('');
      setHoneypot('');
    } catch (err) {
      const data = err.response?.data;
      const msg =
        data?.error ||
        data?.errors?.[0]?.msg ||
        (err.message === 'Network Error'
          ? 'No hay conexión con el servidor. Comprueba tu red o inténtalo más tarde.'
          : 'No se pudo enviar el mensaje.');
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <LegalDocumentLayout title="Contacto">
      <p className="text-sm text-muted-foreground leading-relaxed">
        ¿Dudas sobre la aplicación, privacidad o los términos? Envía un mensaje; intentaremos responderte por correo.
      </p>

      <p className="text-sm text-muted-foreground leading-relaxed">
        También puedes revisar la{' '}
        <Link to="/privacidad" className="text-foreground underline underline-offset-4">
          política de privacidad
        </Link>{' '}
        y los{' '}
        <Link to="/terminos" className="text-foreground underline underline-offset-4">
          términos de servicio
        </Link>
        .
      </p>

      <form onSubmit={handleSubmit} className="space-y-6 max-w-lg">
        <div className="hidden" aria-hidden="true">
          <label htmlFor="contact-website">No rellenar</label>
          <input
            id="contact-website"
            name="website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="contact-name">Nombre</Label>
          <Input
            id="contact-name"
            name="name"
            type="text"
            required
            maxLength={200}
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={submitting}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="contact-email">Correo electrónico</Label>
          <Input
            id="contact-email"
            name="email"
            type="email"
            required
            maxLength={320}
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={submitting}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="contact-message">Mensaje</Label>
          <Textarea
            id="contact-message"
            name="message"
            required
            minLength={10}
            maxLength={10000}
            rows={6}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={submitting}
            placeholder="Escribe tu consulta (mínimo 10 caracteres)."
          />
          <p className="text-xs text-muted-foreground">{message.length} / 10000</p>
        </div>

        <Button type="submit" disabled={submitting}>
          {submitting ? 'Enviando…' : 'Enviar mensaje'}
        </Button>
      </form>

      <Alert className="max-w-lg border-muted">
        <AlertDescription className="text-xs text-muted-foreground">
          Los datos que envíes se usarán solo para atender tu consulta, conforme a nuestra política de privacidad.
        </AlertDescription>
      </Alert>
    </LegalDocumentLayout>
  );
};

export default Contact;
