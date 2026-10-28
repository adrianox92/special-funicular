'use strict';

const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const { z } = require('zod');
const tools = require('../lib/mcpReadTools');

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true };

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
function createSlotMcpServer(userId) {
  const server = new McpServer({ name: 'slot-database', version: '1.0.0' });
  const call = (fn) => wrap((args) => fn(userId, args));

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

  server.registerTool('search_catalog', {
    title: 'Buscar en el catálogo',
    description: 'Busca en el catálogo público de Slot Database por modelo, referencia o fabricante. q tiene al menos 2 caracteres.',
    inputSchema: { q: z.string().min(2).max(80) },
    annotations: READ_ONLY,
  }, call(tools.searchCatalog));

  server.registerTool('get_catalog_item', {
    title: 'Ficha de catálogo',
    description: 'Detalle de un ítem del catálogo público. id es el UUID del ítem.',
    inputSchema: { id: z.string().uuid() },
    annotations: READ_ONLY,
  }, call(tools.getCatalogItem));

  return server;
}

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {string} userId
 */
async function handleMcpHttp(req, res, userId) {
  const server = createSlotMcpServer(userId);
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
