import React from 'react';
import { Link } from 'react-router-dom';
import LegalDocumentLayout from '../components/LegalDocumentLayout';

const Section = ({ children }) => <div className="space-y-3">{children}</div>;

const TermsOfService = () => {
  return (
    <LegalDocumentLayout title="Términos de servicio">
      <p className="text-sm text-muted-foreground">Última actualización: 8 de abril de 2026</p>

      <Section>
        <h2 className="text-xl font-semibold text-foreground">Aceptación</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Al acceder o usar Slot Database (en adelante, «el servicio»), aceptas estos términos. Si no estás
          de acuerdo, no utilices el servicio. El uso continuado tras la publicación de cambios implica la aceptación
          de las modificaciones que resulten aplicables.
        </p>
      </Section>

      <Section>
        <h2 className="text-xl font-semibold text-foreground">Descripción del servicio</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Slot Database es una aplicación web para gestionar colecciones de coches de slot, tiempos,
          circuitos, inventario de piezas, competiciones y funciones relacionadas. El servicio puede evolucionar:
          se pueden añadir, modificar o retirar funcionalidades. La disponibilidad no es garantizada al 100 %;
          pueden producirse interrupciones por mantenimiento, causas técnicas o de fuerza mayor.
        </p>
      </Section>

      <Section>
        <h2 className="text-xl font-semibold text-foreground">Cuenta y elegibilidad</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Para usar las funciones que requieran registro debes proporcionar datos veraces y mantener la seguridad
          de tu cuenta (por ejemplo, contraseña y dispositivos). Eres responsable de la actividad realizada con tu
          cuenta salvo que demuestres un acceso no autorizado y nos lo comuniques sin demora indebida.
        </p>
      </Section>

      <Section>
        <h2 className="text-xl font-semibold text-foreground">Contenido y datos del usuario</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Conservas la titularidad de los datos y contenidos que introduzcas (fichas de vehículos, tiempos,
          inventario, etc.). Nos concedes la licencia necesaria para alojarlos, procesarlos y mostrarlos según las
          funciones del servicio (incluidas sincronización, copias de seguridad del proveedor y visualización en
          interfaces que habilites, como competiciones o perfiles públicos cuando existan y los configures así).
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Te comprometes a no cargar información ilegal, que vulnere derechos de terceros o que infrinja la normativa
          aplicable. Podemos retirar contenido o restringir el acceso si existe indicio razonable de incumplimiento
          o si una autoridad así lo exige.
        </p>
      </Section>

      <Section>
        <h2 className="text-xl font-semibold text-foreground">Propiedad intelectual del servicio</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          El software, el diseño, la estructura, la documentación, las marcas, los nombres comerciales
          y demás elementos distintivos del servicio (incluido el nombre «Slot Database» cuando
          se use como signo del servicio) son titularidad del responsable del servicio o de sus
          licenciantes y están protegidos por la legislación aplicable. Quedan reservados todos los
          derechos no concedidos expresamente en estos términos.
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          No se te otorga licencia para copiar, modificar, distribuir, descompilar, realizar
          ingeniería inversa, crear obras derivadas ni explotar el código o los activos del servicio
          fuera del uso permitido como usuario final a través de la aplicación y la API según lo
          previsto expresamente. Cualquier uso distinto requiere acuerdo previo por escrito.
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Lo anterior no limita los derechos que te asistan como titular de los contenidos que
          introduzcas en el servicio, conforme a la sección «Contenido y datos del usuario».
        </p>
      </Section>

      <Section>
        <h2 className="text-xl font-semibold text-foreground">Uso prohibido</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">Queda prohibido:</p>
        <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground leading-relaxed">
          <li>Usar el servicio de forma que pueda dañar, sobrecargar o comprometer la seguridad de sistemas o de otros usuarios.</li>
          <li>Intentar acceder sin autorización a datos, cuentas o infraestructura del servicio o de terceros.</li>
          <li>Utilizar el servicio para distribuir malware, spam o contenido ilícito o que constituya acoso, odio o amenazas.</li>
          <li>Realizar ingeniería inversa o extracción masiva automatizada no permitida expresamente (scraping abusivo).</li>
        </ul>
      </Section>

      <Section>
        <h2 className="text-xl font-semibold text-foreground">Limitación de responsabilidad</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          El servicio se ofrece «tal cual» y «según disponibilidad», en la medida permitida por la ley. No garantizamos
          resultados concretos ni la ausencia total de errores. No seremos responsables de daños indirectos o lucro
          cesante salvo que la normativa imperativa disponga lo contrario. En cualquier caso, cuando la ley lo
          permita, la responsabilidad agregada quedará limitada a lo razonable en relación con el uso gratuito o de
          pago del servicio, según corresponda.
        </p>
      </Section>

      <Section>
        <h2 className="text-xl font-semibold text-foreground">Suspensión y baja</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Podemos suspender o cancelar cuentas que incumplan estos términos o la ley. Puedes dejar de usar el
          servicio y solicitar la baja de tu cuenta según las opciones disponibles en la aplicación. Tras la baja
          aplicarán las políticas de conservación y eliminación descritas en la política de privacidad.
        </p>
      </Section>

      <Section>
        <h2 className="text-xl font-semibold text-foreground">Cambios</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Podemos modificar estos términos. Publicaremos la versión actualizada en esta página con la fecha de
          actualización. Los cambios sustanciales se comunicarán por medios razonables (por ejemplo, aviso en el
          servicio o correo electrónico a la dirección de tu cuenta) cuando sea exigible.
        </p>
      </Section>

      <Section>
        <h2 className="text-xl font-semibold text-foreground">Legislación aplicable</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Salvo que la normativa de consumo de tu país imponga otra cosa, estos términos se rigen por la legislación
          española. Los tribunales competentes serán los que correspondan según dicha normativa, sin perjuicio de los
          derechos que como consumidor puedan asistirte de forma imperativa.
        </p>
      </Section>

      <Section>
        <h2 className="text-xl font-semibold text-foreground">Contacto</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Para consultas sobre estos términos, utiliza la{' '}
          <Link to="/contacto" className="text-foreground underline underline-offset-4 hover:text-foreground/90">
            página de contacto
          </Link>
          .
        </p>
      </Section>
    </LegalDocumentLayout>
  );
};

export default TermsOfService;
