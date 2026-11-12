/** URLs públicas de Slot Database API (D14: solo producción y local). */

export const PARTNER_API_PRODUCTION_ORIGIN = 'https://api.slotdatabase.es';
export const PARTNER_API_LOCAL_ORIGIN = 'http://localhost:5001';

/** URL que el usuario pega en Claude o ChatGPT. La web hace de proxy. */
export const MCP_CONNECTOR_URL = 'https://www.slotdatabase.es/mcp';

export const PARTNER_SWAGGER_PATH = '/api/docs';
export const PARTNER_OPENAPI_PATH = '/api/docs/openapi.yaml';

export const PARTNER_SWAGGER_PRODUCTION_URL = `${PARTNER_API_PRODUCTION_ORIGIN}${PARTNER_SWAGGER_PATH}`;
export const PARTNER_OPENAPI_PRODUCTION_URL = `${PARTNER_API_PRODUCTION_ORIGIN}${PARTNER_OPENAPI_PATH}`;

export const PARTNER_SWAGGER_LOCAL_URL = `${PARTNER_API_LOCAL_ORIGIN}${PARTNER_SWAGGER_PATH}`;
export const PARTNER_OPENAPI_LOCAL_URL = `${PARTNER_API_LOCAL_ORIGIN}${PARTNER_OPENAPI_PATH}`;

export const DEVELOPERS_PATH = '/developers';
export const PROFILE_PATH = '/profile';
export const CONTACT_PATH = '/contacto';
