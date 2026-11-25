'use strict';

const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const { z } = require('zod');
const { getServiceClient } = require('../lib/supabaseClients');
const tools = require('../lib/mcpReadTools');
const insight = require('../lib/mcpInsightTools');
const adminCatalog = require('../lib/mcpAdminCatalog');

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true };
const ADMIN_WRITE = { readOnlyHint: false, destructiveHint: false, idempotentHint: true };

function textResult(data) {
  let text = JSON.stringify(data);
  if (text.length > 80000) text = `${text.slice(0, 80000)}…`;
  return { content: [{ type: 'text', text }] };
}

function toolError(err) {
  const message = err && err.message ? err.message : 'Error al consultar';
  return { content: [{ type: 'text', text: message }], isError: true };
}

function wrap(fn) {
  return async (args) => {
    try {
      return textResult(await fn(args || {}));
    } catch (err) {
      return toolError(err);
    }
  };
}

/**
 * Servidor MCP nuevo por petición (transporte sin sesión).
 * @param {string} userId
 */
async function createSlotMcpServer(userId, context = {}) {
  const isAdmin = await adminCatalog.resolveMcpAdmin(getServiceClient(), userId);
  const callContext = { ...context, isAdmin };
  const server = new McpServer({ name: 'slot-database', version: '1.3.0' });
  const call = (fn) => wrap((args) => fn(userId, args, callContext));

  server.registerTool('search_collection', {
    title: 'Buscar en la colección',
    description: 'Busca en el garaje, los circuitos y las competiciones del usuario autenticado. q tiene al menos 2 caracteres. No acepta user_id.',
    inputSchema: { q: z.string().min(2).max(80) },
    annotations: READ_ONLY,
  }, call(tools.searchCollection));

  server.registerTool('list_vehicles', {
    title: 'Listar vehículos',
    description: 'Lista el garaje del usuario. Sin q, página paginada (máximo 25). Con q, filtra por modelo o fabricante.',
    inputSchema: {
      page: z.number().int().min(1).max(200).optional(),
      limit: z.number().int().min(1).max(25).optional(),
      q: z.string().max(80).optional(),
    },
    annotations: READ_ONLY,
  }, call(tools.listVehicles));

  server.registerTool('get_vehicle', {
    title: 'Ficha de vehículo',
    description: 'Detalle de un coche del garaje del usuario. id es el UUID del vehículo.',
    inputSchema: { id: z.string().uuid() },
    annotations: READ_ONLY,
  }, call(tools.getVehicle));

  server.registerTool('list_circuits', {
    title: 'Listar circuitos',
    description: 'Circuitos personales del usuario.',
    inputSchema: {},
    annotations: READ_ONLY,
  }, call(tools.listCircuits));

  server.registerTool('list_timings', {
    title: 'Listar tiempos',
    description: 'Sesiones de entrenamiento del usuario. Filtros opcionales: vehicle_id, circuit_id, lane, date_from y date_to (YYYY-MM-DD). Sin vehicle_id devuelve sesiones recientes del garaje.',
    inputSchema: {
      vehicle_id: z.string().uuid().optional(),
      circuit_id: z.string().uuid().optional(),
      lane: z.string().max(8).optional(),
      date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      limit: z.number().int().min(1).max(25).optional(),
    },
    annotations: READ_ONLY,
  }, call(tools.listTimings));

  server.registerTool('list_competitions', {
    title: 'Listar competiciones',
    description: 'Competiciones que organiza el usuario y las de los clubes a los que pertenece.',
    inputSchema: {},
    annotations: READ_ONLY,
  }, call(tools.listCompetitions));

  server.registerTool('get_competition', {
    title: 'Detalle de competición',
    description: 'Participantes (máximo 40) y progreso resumido de una competición a la que el usuario tiene acceso. id es el UUID.',
    inputSchema: { id: z.string().uuid() },
    annotations: READ_ONLY,
  }, call(tools.getCompetition));

  server.registerTool('get_catalog_item', {
    title: 'Ficha de catálogo',
    description: 'Una sola ficha del catálogo, por referencia y marca exactas. Ejemplo: reference "50402" y manufacturer "Avant Slot". No lista, no busca por modelo y no acepta comodines. Máximo 10 consultas por minuto y 100 al día.',
    inputSchema: {
      reference: z.string().min(2).max(80),
      manufacturer: z.string().min(2).max(80),
    },
    annotations: READ_ONLY,
  }, call(tools.getCatalogItem));

  server.registerTool('list_capabilities', {
    title: 'Opciones del conector',
    description: 'Úsala cuando el usuario pregunte qué puedes hacer o qué opciones hay, antes de inventar capacidades. No consulta datos. Dice también lo que no hace: no lista el catálogo, no escribe y no ve ligas ni clubes.',
    inputSchema: {},
    annotations: READ_ONLY,
  }, call(insight.listCapabilities));

  server.registerTool('garage_summary', {
    title: 'Resumen del garaje',
    description: 'Totales del garaje: coches, modificados, digitales, suma de compra, marcas, tipos y cuántos no tienen ficha de catálogo. Máximo 1000 coches.',
    inputSchema: {},
    annotations: READ_ONLY,
  }, call(insight.garageSummary));

  server.registerTool('best_laps', {
    title: 'Mejores vueltas',
    description: 'Mejor vuelta por coche, circuito y carril. Filtros opcionales: vehicle_id, circuit_id, lane, date_from y date_to (YYYY-MM-DD). Máximo 25 grupos.',
    inputSchema: {
      vehicle_id: z.string().uuid().optional(),
      circuit_id: z.string().uuid().optional(),
      lane: z.string().max(8).optional(),
      date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    },
    annotations: READ_ONLY,
  }, call(insight.bestLaps));

  server.registerTool('training_goals', {
    title: 'Metas de entrenamiento',
    description: 'Metas activas del usuario y su progreso. Máximo 10.',
    inputSchema: {},
    annotations: READ_ONLY,
  }, call(insight.trainingGoals));

  server.registerTool('action_items', {
    title: 'Pendientes',
    description: 'Competiciones propias abiertas, recambios críticos bajo mínimo y mantenimientos que vencen en 7 días. Máximo 5 por bloque.',
    inputSchema: {},
    annotations: READ_ONLY,
  }, call(insight.actionItems));

  server.registerTool('get_circuit', {
    title: 'Ficha de circuito',
    description: 'Circuito personal del usuario, con longitudes de carril y comparativa de tiempos por carril. id es el UUID.',
    inputSchema: { id: z.string().uuid() },
    annotations: READ_ONLY,
  }, call(insight.getCircuit));

  server.registerTool('list_maintenance', {
    title: 'Mantenimiento',
    description: 'Con vehicle_id, las últimas 15 revisiones de ese coche. Sin vehicle_id, 8 revisiones recientes y hasta 10 vencimientos en 7 días.',
    inputSchema: { vehicle_id: z.string().uuid().optional() },
    annotations: READ_ONLY,
  }, call(insight.listMaintenance));

  server.registerTool('list_inventory', {
    title: 'Inventario',
    description: 'Recambios del usuario. Filtros opcionales: q, category y low_stock. Máximo 25.',
    inputSchema: {
      q: z.string().max(80).optional(),
      category: z.string().max(40).optional(),
      low_stock: z.boolean().optional(),
      limit: z.number().int().min(1).max(25).optional(),
    },
    annotations: READ_ONLY,
  }, call(insight.listInventory));

  server.registerTool('get_catalog_offers', {
    title: 'Ofertas de una ficha',
    description: 'Precio y tienda de una ficha concreta, por referencia y marca exactas. No lista el catálogo. Comparte el máximo de 10 consultas por minuto y 100 al día con get_catalog_item.',
    inputSchema: {
      reference: z.string().min(2).max(80),
      manufacturer: z.string().min(2).max(80),
    },
    annotations: READ_ONLY,
  }, call(insight.getCatalogOffers));

  if (isAdmin) {
    server.registerTool('list_incomplete_catalog_items', {
      title: 'Huecos de una marca',
      description: 'Solo administradores. Lista fichas incompletas. manufacturer es opcional: sin marca, recorre todas. missing puede ser incomplete, image, model_name, vehicle_type, traction, motor, year o dorsal. Páginas de 25, ordenadas por marca y referencia. No lista las fichas completas.',
      inputSchema: {
        manufacturer: z.string().max(80).optional(),
        missing: z.enum(['incomplete', 'image', 'model_name', 'vehicle_type', 'traction', 'motor', 'year', 'dorsal']).optional(),
        page: z.number().int().min(1).max(200).optional(),
        limit: z.number().int().min(1).max(25).optional(),
      },
      annotations: READ_ONLY,
    }, call(adminCatalog.listIncompleteCatalogItems));

    server.registerTool('update_catalog_item', {
      title: 'Completar ficha de catálogo',
      description: 'Solo administradores. Completa una ficha (reference y manufacturer) o hasta 25 en items. Campos: model_name, vehicle_type, traction, motor_position (inline, angular o transverse), commercial_release_year y dorsal. Un valor vacío no borra lo que ya hay. No cambia referencia, marca ni foto. Un fallo en una ficha del lote no deshace las demás.',
      inputSchema: {
        reference: z.string().min(2).max(80).optional(),
        manufacturer: z.string().min(2).max(80).optional(),
        model_name: z.string().max(200).optional(),
        vehicle_type: z.string().max(80).optional(),
        traction: z.string().max(80).optional(),
        motor_position: z.string().max(40).optional(),
        commercial_release_year: z.number().int().optional(),
        dorsal: z.string().max(40).optional(),
        items: z.array(z.object({
          reference: z.string().min(2).max(80),
          manufacturer: z.string().min(2).max(80),
          model_name: z.string().max(200).optional(),
          vehicle_type: z.string().max(80).optional(),
          traction: z.string().max(80).optional(),
          motor_position: z.string().max(40).optional(),
          commercial_release_year: z.number().int().optional(),
          dorsal: z.string().max(40).optional(),
        })).max(25).optional(),
      },
      annotations: ADMIN_WRITE,
    }, call(adminCatalog.updateCatalogItem));
  }

  const prompt = (text) => ({ messages: [{ role: 'user', content: { type: 'text', text } }] });

  server.registerPrompt('available_options', {
    title: 'Opciones disponibles',
    description: 'Lista en lenguaje llano lo que este conector puede consultar, sin leer datos del usuario.',
  }, () => prompt('Llama a list_capabilities y responde con esa lista en lenguaje llano. No llames a otras herramientas ni consultes datos.'));

  server.registerPrompt('garage_briefing', {
    title: 'Cómo va el garaje',
    description: 'Resume el garaje y, si el usuario pregunta por pendientes o metas, también esos datos.',
  }, () => prompt('Llama a garage_summary. Si el usuario pregunta por pendientes o metas, llama también a action_items y training_goals. Responde en español solo con los datos devueltos.'));

  server.registerPrompt('next_race_briefing', {
    title: 'Próxima carrera',
    description: 'Resume la próxima competición abierta y, si hay id, su detalle.',
  }, () => prompt('Llama a action_items. Si hay una competición abierta, llama a get_competition con su id. Si no hay ninguna, dilo. No inventes participantes ni tiempos.'));

  return server;
}

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {string} userId
 */
async function handleMcpHttp(req, res, userId, context = {}) {
  const server = await createSlotMcpServer(userId, context);
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } finally {
    await transport.close().catch(() => {});
    await server.close().catch(() => {});
  }
}

module.exports = { createSlotMcpServer, handleMcpHttp };
