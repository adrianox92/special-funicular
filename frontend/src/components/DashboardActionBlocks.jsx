import React from 'react';
import { Link } from 'react-router-dom';
import { Trophy, Clock, Car, Package, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { formatInventoryCategory } from '../utils/formatUtils';

const BlockCard = ({ icon: Icon, title, children, footer }) => (
  <Card className="flex flex-col h-full border-border/80 shadow-sm">
    <CardHeader className="pb-2">
      <CardTitle className="text-base font-semibold flex items-center gap-2">
        {Icon ? <Icon className="size-4 text-primary shrink-0" aria-hidden /> : null}
        {title}
      </CardTitle>
    </CardHeader>
    <CardContent className="flex flex-1 flex-col gap-3 pt-0">
      <div className="flex-1 text-sm text-muted-foreground min-h-[4rem]">{children}</div>
      {footer ? <div className="pt-1 border-t border-border/60">{footer}</div> : null}
    </CardContent>
  </Card>
);

const DashboardActionBlocks = ({ data, loadError }) => {
  if (loadError) {
    return (
      <p className="text-sm text-muted-foreground" role="status">
        No se pudieron cargar las acciones sugeridas. Intenta recargar la página.
      </p>
    );
  }

  if (!data) {
    return null;
  }

  const {
    nextCompetition,
    openCompetitionTimings,
    usualCircuit,
    staleVehiclesAtUsualCircuit,
    staleDaysThreshold = 60,
    lowStockCritical,
  } = data;

  return (
    <section className="space-y-3" aria-labelledby="dash-action-blocks-heading">
      <h2 id="dash-action-blocks-heading" className="text-lg font-semibold tracking-tight">
        Pendientes y alertas
      </h2>
      <p className="text-sm text-muted-foreground -mt-1">
        Accesos rápidos a lo que suele necesitar tu atención. El bloque de circuito habitual considera
        “sin sesión reciente” si llevas más de{' '}
        <span className="font-medium text-foreground">{staleDaysThreshold} días</span> sin rodar ahí
        (ajústalo en{' '}
        <Link to="/profile" className="text-foreground underline underline-offset-2 hover:no-underline">
          Mi Perfil → Configuración
        </Link>
        ).
      </p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <BlockCard
          icon={Trophy}
          title="Próxima competición"
          footer={
            <Button variant="ghost" size="sm" className="w-full justify-between px-2" asChild>
              <Link to="/competitions">
                Ir a competiciones
                <ChevronRight className="size-4" aria-hidden />
              </Link>
            </Button>
          }
        >
          {nextCompetition ? (
            <div className="space-y-2 text-foreground">
              <p className="font-medium leading-snug">{nextCompetition.name}</p>
              {nextCompetition.circuit_name ? (
                <p className="text-muted-foreground">{nextCompetition.circuit_name}</p>
              ) : null}
              <p>
                {nextCompetition.times_remaining > 0
                  ? `${nextCompetition.times_remaining} tiempo${nextCompetition.times_remaining !== 1 ? 's' : ''} por registrar · ${nextCompetition.progress_percentage}%`
                  : 'En curso'}
              </p>
              <Button size="sm" className="mt-1" asChild>
                <Link to={`/competitions/${nextCompetition.id}/timings`}>Registrar tiempos</Link>
              </Button>
            </div>
          ) : (
            <p>No hay competiciones con tiempos pendientes (con participantes).</p>
          )}
        </BlockCard>

        <BlockCard
          icon={Clock}
          title="Tiempos sin cerrar"
          footer={
            <Button variant="ghost" size="sm" className="w-full justify-between px-2" asChild>
              <Link to="/competitions">
                Ver todas
                <ChevronRight className="size-4" aria-hidden />
              </Link>
            </Button>
          }
        >
          {openCompetitionTimings?.length ? (
            <ul className="space-y-2 list-none p-0 m-0">
              {openCompetitionTimings.map((c) => (
                <li key={c.id} className="border-b border-border/50 last:border-0 pb-2 last:pb-0">
                  <Link
                    to={`/competitions/${c.id}/timings`}
                    className="font-medium text-foreground hover:underline"
                  >
                    {c.name}
                  </Link>
                  <p className="text-xs mt-0.5">
                    Faltan {c.times_remaining} de {c.total_required_times} · {c.progress_percentage}%
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p>Todas las competiciones con participantes tienen los tiempos completos.</p>
          )}
        </BlockCard>

        <BlockCard
          icon={Car}
          title="Circuito habitual"
          footer={
            <Button variant="ghost" size="sm" className="w-full justify-between px-2" asChild>
              <Link to="/timings">
                Ver tiempos
                <ChevronRight className="size-4" aria-hidden />
              </Link>
            </Button>
          }
        >
          {!usualCircuit ? (
            <p>
              Añade sesiones en Tiempos para detectar automáticamente el circuito que más usas.
            </p>
          ) : staleVehiclesAtUsualCircuit?.length ? (
            <div className="space-y-2">
              <p className="text-foreground">
                En <span className="font-medium">{usualCircuit.name}</span> llevan más de{' '}
                {staleDaysThreshold} días sin sesión:
              </p>
              <ul className="space-y-1.5 list-none p-0 m-0">
                {staleVehiclesAtUsualCircuit.map((v) => (
                  <li key={v.id}>
                    <Link
                      to={`/vehicles/${v.id}`}
                      className="text-foreground hover:underline font-medium"
                    >
                      {[v.manufacturer, v.model].filter(Boolean).join(' ') || 'Vehículo'}
                    </Link>
                    <span className="text-muted-foreground text-xs ml-1">
                      (hace {v.days_since} días)
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p>
              En <span className="font-medium text-foreground">{usualCircuit.name}</span> todos los
              coches que ya rodaron ahí tienen sesión reciente (últimos {staleDaysThreshold} días).
            </p>
          )}
        </BlockCard>

        <BlockCard
          icon={Package}
          title="Inventario crítico bajo"
          footer={
            <Button variant="ghost" size="sm" className="w-full justify-between px-2" asChild>
              <Link to="/inventory">
                Abrir inventario
                <ChevronRight className="size-4" aria-hidden />
              </Link>
            </Button>
          }
        >
          {lowStockCritical?.length ? (
            <ul className="space-y-2 list-none p-0 m-0">
              {lowStockCritical.map((item) => (
                <li key={item.id} className="border-b border-border/50 last:border-0 pb-2 last:pb-0">
                  <p className="font-medium text-foreground">{item.name}</p>
                  <p className="text-xs">
                    {formatInventoryCategory(item.category)} · {item.quantity}/{item.min_stock}{' '}
                    {item.reference ? `· ${item.reference}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p>No hay repuestos críticos por debajo del mínimo (motor, guía, piñonería, ruedas…).</p>
          )}
        </BlockCard>
      </div>
    </section>
  );
};

export default DashboardActionBlocks;
