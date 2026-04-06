import React from 'react';
import { Link } from 'react-router-dom';
import {
  Home,
  Car,
  Clock,
  Flag,
  Package,
  Trophy,
  User,
  Settings,
  BookOpen,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Separator } from '../components/ui/separator';
import { Badge } from '../components/ui/badge';
const toc = [
  { id: 'inicio', label: 'Inicio', icon: Home },
  { id: 'vehiculos', label: 'Vehículos', icon: Car },
  { id: 'tiempos', label: 'Tiempos', icon: Clock },
  { id: 'circuitos', label: 'Circuitos', icon: Flag },
  { id: 'inventario', label: 'Inventario', icon: Package },
  { id: 'competiciones', label: 'Competiciones', icon: Trophy },
  { id: 'configuracion', label: 'Configuración', icon: Settings },
  { id: 'perfil', label: 'Perfil', icon: User },
];

const BulletList = ({ items }) => (
  <ul className="list-disc pl-5 space-y-1.5 text-sm text-muted-foreground">
    {items.map((t) => (
      <li key={t}>{t}</li>
    ))}
  </ul>
);

const HelpPage = () => (
  <div className="space-y-8 max-w-3xl">
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-primary">
        <BookOpen className="size-7" aria-hidden />
        <h1 className="text-2xl font-bold tracking-tight">Centro de ayuda</h1>
      </div>
      <p className="text-muted-foreground text-sm">
        Guía de las secciones de Slot Pro: qué hace cada una, qué conviene tener en cuenta y datos útiles.
      </p>
    </div>

    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Índice</CardTitle>
        <CardDescription>Saltar a una sección o abrirla en la app.</CardDescription>
      </CardHeader>
      <CardContent>
        <nav aria-label="Índice de ayuda" className="flex flex-wrap gap-2">
          {toc.map(({ id, label, icon: Icon }) => (
              <a
                key={id}
                href={`#${id}`}
                className="inline-flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1.5 text-sm font-medium hover:bg-accent"
              >
                <Icon className="size-3.5" aria-hidden />
                {label}
              </a>
            ))}
        </nav>
      </CardContent>
    </Card>

    <section id="inicio" className="scroll-mt-24">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Home className="size-5 text-primary" aria-hidden />
              Inicio
            </CardTitle>
            <Badge variant="secondary">/dashboard</Badge>
          </div>
          <CardDescription>
            Resumen de tu colección: números clave, gráficos y sugerencias de acción.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p>
            Aquí ves inversión total, reparto por tipo de vehículo, marcas, tiendas, componentes con más coste y tendencias.
            También aparecen competiciones activas y bloques de acceso rápido al resto del sitio.
          </p>
          <div>
            <p className="font-medium text-foreground mb-2">Qué tener en cuenta</p>
            <BulletList
              items={[
                'Los datos dependen de lo que registres en vehículos, componentes y tiempos.',
                'Si algo falla al cargar, revisa la conexión; parte de la información viene de varias peticiones al servidor.',
              ]}
            />
          </div>
          <Link to="/dashboard" className="text-primary text-sm font-medium hover:underline inline-flex">
            Ir a Inicio →
          </Link>
        </CardContent>
      </Card>
    </section>

    <section id="vehiculos" className="scroll-mt-24">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Car className="size-5 text-primary" aria-hidden />
              Vehículos
            </CardTitle>
            <Badge variant="secondary">/vehicles</Badge>
          </div>
          <CardDescription>
            Catálogo de coches: alta, edición, filtros y exportación.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p>
            Puedes ver la lista en cuadrícula o tabla, filtrar por fabricante, tipo, modificado/analógico-digital, y marcar
            criterios como museo o taller. Los filtros se guardan en este navegador para la próxima visita.
          </p>
          <div>
            <p className="font-medium text-foreground mb-2">Qué tener en cuenta</p>
            <BulletList
              items={[
                'Cada vehículo tiene una ficha detallada (componentes, mantenimiento, tiempos asociados, etc.).',
                '“Añadir vehículo” y la edición usan el mismo modelo de datos: cuanto más completa la ficha, mejores métricas en Inicio y Tiempos.',
                'La exportación y la paginación respetan filtros y límites que configures en pantalla.',
              ]}
            />
          </div>
          <Link to="/vehicles" className="text-primary text-sm font-medium hover:underline inline-flex">
            Ir a Vehículos →
          </Link>
        </CardContent>
      </Card>
    </section>

    <section id="tiempos" className="scroll-mt-24">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock className="size-5 text-primary" aria-hidden />
              Tiempos
            </CardTitle>
            <Badge variant="secondary">/timings</Badge>
          </div>
          <CardDescription>
            Registro de sesiones por vehículo, circuito y carril: mejores vueltas, velocidad y comparativas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p>
            Los tiempos se agrupan por vehículo, circuito y carril. Puedes ampliar el historial de sesiones, ver especificaciones
            de la sesión, comparar sesiones, analizar rendimiento e importar datos cuando la app lo permita.
          </p>
          <div>
            <p className="font-medium text-foreground mb-2">Qué tener en cuenta</p>
            <BulletList
              items={[
                'Los circuitos deben existir en la sección Circuitos para que los registros sean coherentes.',
                'El carril y la distancia influyen en rankings y estadísticas por circuito.',
                'Si usas integraciones externas (por ejemplo envío de tiempos), revisa en Perfil la API y las notificaciones.',
              ]}
            />
          </div>
          <Link to="/timings" className="text-primary text-sm font-medium hover:underline inline-flex">
            Ir a Tiempos →
          </Link>
        </CardContent>
      </Card>
    </section>

    <section id="circuitos" className="scroll-mt-24">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Flag className="size-5 text-primary" aria-hidden />
              Circuitos
            </CardTitle>
            <Badge variant="secondary">/circuits</Badge>
          </div>
          <CardDescription>
            Tus pistas: nombre, descripción, número de carriles y longitud por carril.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p>
            Define aquí las pistas que usarás en tiempos y competiciones. Al crear o editar, indica cuántos carriles tiene y,
            si aplica, la longitud de cada uno.
          </p>
          <div>
            <p className="font-medium text-foreground mb-2">Qué tener en cuenta</p>
            <BulletList
              items={[
                'Al crear una competición puedes asociar un circuito; conviene tenerlo dado de alta antes.',
                'Borrar un circuito puede afectar a datos que lo referencian: hazlo solo si estás seguro.',
              ]}
            />
          </div>
          <Link to="/circuits" className="text-primary text-sm font-medium hover:underline inline-flex">
            Ir a Circuitos →
          </Link>
        </CardContent>
      </Card>
    </section>

    <section id="inventario" className="scroll-mt-24">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Package className="size-5 text-primary" aria-hidden />
              Inventario
            </CardTitle>
            <Badge variant="secondary">/inventory</Badge>
          </div>
          <CardDescription>
            Piezas y consumibles: stock, categorías, precios y vínculo con vehículos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p>
            Gestiona repuestos con categoría, unidades, precio de compra, fechas y notas. Puedes filtrar por categoría, búsqueda
            y stock bajo, reponer cantidades, montar piezas en un vehículo y consultar el historial de movimientos.
          </p>
          <div>
            <p className="font-medium text-foreground mb-2">Qué tener en cuenta</p>
            <BulletList
              items={[
                'El stock mínimo ayuda a ver qué necesitas reponer.',
                'Montar una pieza en un vehículo descuenta del inventario según la lógica de la aplicación.',
                'Algunos campos son específicos del tipo de pieza (material, piñonería, etc.).',
              ]}
            />
          </div>
          <Link to="/inventory" className="text-primary text-sm font-medium hover:underline inline-flex">
            Ir a Inventario →
          </Link>
        </CardContent>
      </Card>
    </section>

    <section id="competiciones" className="scroll-mt-24">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Trophy className="size-5 text-primary" aria-hidden />
              Competiciones
            </CardTitle>
            <Badge variant="secondary">/competitions</Badge>
          </div>
          <CardDescription>
            Eventos con plazas, rondas, circuito, participantes y gestión de tiempos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p>
            Crea competiciones indicando nombre, plazas, número de rondas y, opcionalmente, circuito. Tras crearla, accedes a la
            gestión de participantes (inscripciones, categorías, reglas) y a la pantalla de tiempos de la competición.
          </p>
          <p className="text-muted-foreground">
            Existen URLs públicas para inscripción, estado y presentación usando el identificador (slug) del evento; no requieren
            iniciar sesión en la web principal.
          </p>
          <div>
            <p className="font-medium text-foreground mb-2">Qué tener en cuenta</p>
            <BulletList
              items={[
                'Necesitas circuitos creados si quieres asociar uno al crear la competición.',
                'Desde la lista puedes abrir participantes y tiempos según el flujo de cada evento.',
              ]}
            />
          </div>
          <Link to="/competitions" className="text-primary text-sm font-medium hover:underline inline-flex">
            Ir a Competiciones →
          </Link>
        </CardContent>
      </Card>
    </section>

    <section id="configuracion" className="scroll-mt-24">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Settings className="size-5 text-primary" aria-hidden />
              Configuración
            </CardTitle>
            <Badge variant="secondary">/settings</Badge>
          </div>
          <CardDescription>
            Preferencias del dashboard, notificaciones y cambio de contraseña.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p>
            Umbral de días sin sesión en tu circuito habitual (para el bloque “Pendientes y alertas” del inicio), webhook de
            Discord y Chat ID de Telegram. La pestaña Cuenta permite cambiar la contraseña sin escribir la anterior (sesión
            iniciada), o definirla si solo usas Google.
            Puedes usar <code className="rounded bg-muted px-1 py-0.5 text-xs">?tab=notifications</code> o{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">?tab=cuenta</code> en la URL para abrir la pestaña deseada.
          </p>
          <div>
            <p className="font-medium text-foreground mb-2">Qué tener en cuenta</p>
            <BulletList
              items={[
                'Tras cambiar el umbral de días, recarga el dashboard para ver el nuevo criterio en alertas.',
                'El cambio de contraseña en Cuenta no pide la anterior: basta con tener la sesión iniciada.',
                'Regenerar API key no se hace aquí: la clave de integración está en Mi perfil.',
              ]}
            />
          </div>
          <Link to="/settings" className="text-primary text-sm font-medium hover:underline inline-flex">
            Ir a Configuración →
          </Link>
        </CardContent>
      </Card>
    </section>

    <section id="perfil" className="scroll-mt-24">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <User className="size-5 text-primary" aria-hidden />
              Perfil
            </CardTitle>
            <Badge variant="secondary">/profile</Badge>
          </div>
          <CardDescription>
            Cuenta, clave API de integración y licencia Slot Race Manager.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p>
            Consulta tu email, genera o regenera la API key para el header{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">X-API-Key</code>, y revisa las instalaciones de la licencia
            de escritorio. Las preferencias del dashboard y Discord/Telegram están en Configuración.
          </p>
          <div>
            <p className="font-medium text-foreground mb-2">Qué tener en cuenta</p>
            <BulletList
              items={[
                'Regenerar la API key invalida la anterior: actualiza cualquier script o dispositivo que la use.',
                'Los metadatos de usuario se sincronizan con el proveedor de autenticación; si algo no guarda, revisa permisos de sesión.',
              ]}
            />
          </div>
          <Link to="/profile" className="text-primary text-sm font-medium hover:underline inline-flex">
            Ir a Perfil →
          </Link>
        </CardContent>
      </Card>
    </section>

    <Separator />

    <p className="text-xs text-muted-foreground">
      ¿Algo no cuadra con lo que ves en pantalla? Comprueba que estás en la última versión de la app y vuelve a cargar la página.
    </p>
  </div>
);

export default HelpPage;
