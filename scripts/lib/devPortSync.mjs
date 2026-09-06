import { readYamlPortConfig } from './devLauncherCore.mjs';

function parsePort(value, fallback) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** Resolve Bridge/API base URL for scripts (env > yaml > default). */
export function resolveServerUrl(env = process.env) {
  const explicit = env.SERVER_URL?.replace(/\/$/, '');
  if (explicit) return explicit;
  const yaml = readYamlPortConfig();
  const serverPort = parsePort(env.SERVER_PORT, yaml.serverPort ?? 3001);
  return `http://127.0.0.1:${serverPort}`;
}

/** Resolve Vite UI base URL for Playwright (env > yaml > default). */
export function resolvePlaywrightBaseUrl(env = process.env) {
  const explicit = env.PLAYWRIGHT_BASE_URL || env.VITE_URL || env.BASE_URL;
  if (explicit) return String(explicit).replace(/\/$/, '');
  const yaml = readYamlPortConfig();
  const vitePort = parsePort(env.VITE_PORT, yaml.vitePort ?? 5173);
  return `http://127.0.0.1:${vitePort}`;
}

/**
 * Read the dev port map from environment variables (after dev-launcher resolution).
 */
export function mapPorts(env = process.env) {
  const serverPort = parsePort(env.SERVER_PORT, 3001);
  const gatewayPort = parsePort(env.PILOTDECK_GATEWAY_PORT, 18789);
  const vitePort = parsePort(env.VITE_PORT, 5173);
  const gatewayUrl =
    env.PILOTDECK_GATEWAY_URL ?? `ws://127.0.0.1:${gatewayPort}/ws`;

  return {
    serverPort,
    gatewayPort,
    vitePort,
    gatewayUrl,
  };
}
