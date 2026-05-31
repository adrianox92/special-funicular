/**
 * Resuelve el enlace visible del reglamento (URL externa o fichero subido).
 * @param {{ regulation_url?: string|null, regulation_file_url?: string|null, regulation_file_name?: string|null }|null|undefined} source
 */
export function resolveRegulationLink(source) {
  if (!source) return null;
  if (source.regulation_url) {
    return {
      href: source.regulation_url,
      label: 'Ver reglamento',
      external: true,
    };
  }
  if (source.regulation_file_url) {
    return {
      href: source.regulation_file_url,
      label: source.regulation_file_name || 'Descargar reglamento',
      external: false,
    };
  }
  return null;
}

/**
 * @param {{ regulation_url?: string|null, regulation_file_path?: string|null, regulation_file_name?: string|null }|null|undefined} source
 */
export function hasRegulation(source) {
  return Boolean(
    source?.regulation_url || source?.regulation_file_path || source?.regulation_file_name
  );
}
