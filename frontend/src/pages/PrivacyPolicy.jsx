import React from 'react';
import { Link } from 'react-router-dom';
import LegalDocumentLayout from '../components/LegalDocumentLayout';

const Section = ({ children }) => <div className="space-y-3">{children}</div>;

const PrivacyPolicy = () => {
  return (
    <LegalDocumentLayout title="Política de privacidad">
      <p className="text-sm text-muted-foreground">Última actualización: 6 de abril de 2026</p>

      <Section>
        <h2 className="text-xl font-semibold text-foreground">Introducción</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Slot Database (en adelante, «el servicio») respeta tu privacidad. Esta política describe qué datos
          recopilamos, cómo los usamos y cuáles son tus derechos. Al usar el servicio, aceptas esta política en la
          medida en que resulte de aplicación junto con la normativa vigente.
        </p>
      </Section>

      <Section>
        <h2 className="text-xl font-semibold text-foreground">Responsable del tratamiento</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          El titular del servicio es Adrian Palomera Sanz. Para consultas sobre protección de datos puedes usar la{' '}
          <Link to="/contacto" className="text-foreground underline underline-offset-4 hover:text-foreground/90">
            página de contacto
          </Link>
          .
        </p>
      </Section>

      <Section>
        <h2 className="text-xl font-semibold text-foreground">Datos que recopilamos</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Tratamos la información necesaria para prestar el servicio de gestión de colección, tiempos,
          competiciones, inventario y funciones relacionadas:
        </p>
        <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground leading-relaxed">
          <li>
            <strong className="text-foreground">Datos de cuenta:</strong> correo electrónico y datos de perfil
            asociados al registro e inicio de sesión (por ejemplo, identificador de usuario y metadatos que
            permitas guardar).
          </li>
          <li>
            <strong className="text-foreground">Datos que introduces en la aplicación:</strong> información
            sobre vehículos, tiempos, circuitos, inventario, competiciones, participantes y cualquier otro
            contenido que cargues o generes al usar las funciones del servicio.
          </li>
          <li>
            <strong className="text-foreground">Datos técnicos y de uso:</strong> identificadores de sesión,
            registros de seguridad necesarios para el funcionamiento de la API, y —si aceptas cookies no
            esenciales— métricas de rendimiento y analítica agregada para mejorar el servicio.
          </li>
        </ul>
      </Section>

      <Section>
        <h2 className="text-xl font-semibold text-foreground">Finalidad y base legal</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Los datos se tratan para ejecutar el contrato de prestación del servicio (gestión de tu cuenta y de los
          contenidos que almacenes), cumplir obligaciones legales cuando aplican, y en su caso para el interés
          legítimo en la seguridad y mejora del servicio. El uso de cookies de analítica se basa en tu
          consentimiento, que puedes retirar en cualquier momento desde «Gestionar cookies» en el pie.
        </p>
      </Section>

      <Section>
        <h2 className="text-xl font-semibold text-foreground">Cookies</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Utilizamos cookies y almacenamiento local conforme a tus preferencias:
        </p>
        <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground leading-relaxed">
          <li>
            <strong className="text-foreground">Necesarias:</strong> sesión, autenticación y funcionamiento
            básico de la aplicación.
          </li>
          <li>
            <strong className="text-foreground">Funcionales (opcionales):</strong> preferencias que elijas
            activar en la configuración de cookies.
          </li>
          <li>
            <strong className="text-foreground">Analítica (opcionales):</strong> métricas de uso y rendimiento
            (por ejemplo, Vercel Analytics y Speed Insights) solo si aceptas ese apartado.
          </li>
        </ul>
      </Section>

      <Section>
        <h2 className="text-xl font-semibold text-foreground">Encargados y terceros</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Para operar el servicio recurrimos a proveedores que tratan datos en nuestro nombre o en su
          condición de responsables independientes, según corresponda:
        </p>
        <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground leading-relaxed">
          <li>
            <strong className="text-foreground">Supabase</strong> — autenticación y base de datos.{' '}
            <a
              href="https://supabase.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-4 hover:text-foreground"
            >
              Política de privacidad de Supabase
            </a>
          </li>
          <li>
            <strong className="text-foreground">Vercel</strong> — alojamiento y, si aceptas analítica,
            métricas de uso y rendimiento.{' '}
            <a
              href="https://vercel.com/legal/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-4 hover:text-foreground"
            >
              Política de privacidad de Vercel
            </a>
          </li>
        </ul>
        <p className="text-sm text-muted-foreground leading-relaxed">
          No vendemos tus datos personales. Solo compartimos datos con terceros cuando es necesario para el
          servicio, por obligación legal o con tu consentimiento explícito.
        </p>
      </Section>

      <Section>
        <h2 className="text-xl font-semibold text-foreground">Conservación</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Conservamos los datos mientras mantengas la cuenta activa o sea necesario para cumplir la finalidad
          para la que se recogieron. Tras la baja de la cuenta, aplicaremos los plazos de eliminación o
          anonimización que permitan la tecnología y la obligación legal aplicable.
        </p>
      </Section>

      <Section>
        <h2 className="text-xl font-semibold text-foreground">Tus derechos</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Puedes ejercer los derechos de acceso, rectificación, supresión, limitación, oposición y portabilidad
          cuando corresponda, así como retirar el consentimiento en el tratamiento basado en él. Para ello puedes
          utilizar las funciones de la aplicación o contactar a través de los medios indicados. Si resides en la
          UE, tienes derecho a presentar una reclamación ante la autoridad de protección de datos competente.
        </p>
      </Section>

      <Section>
        <h2 className="text-xl font-semibold text-foreground">Cambios en esta política</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Podemos actualizar esta política. Los cambios relevantes se publicarán en esta página con una nueva
          fecha de actualización. Si el cambio lo exige la ley, te informaremos por medios adecuados.
        </p>
      </Section>

      <Section>
        <h2 className="text-xl font-semibold text-foreground">Contacto</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Para ejercer tus derechos o plantear consultas sobre privacidad, utiliza los canales de contacto
          publicados en la aplicación o en el sitio web del servicio cuando estén disponibles.
        </p>
      </Section>
    </LegalDocumentLayout>
  );
};

export default PrivacyPolicy;
