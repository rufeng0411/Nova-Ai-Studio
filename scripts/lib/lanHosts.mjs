import os from 'node:os';

function isIPv4(net) {
  return net.family === 'IPv4' || net.family === 4;
}

/** Non-loopback IPv4 addresses suitable for LAN browser URLs. */
export function listLanIPv4() {
  const nets = os.networkInterfaces();
  const ips = [];
  for (const entries of Object.values(nets)) {
    for (const net of entries ?? []) {
      if (isIPv4(net) && !net.internal) {
        ips.push(net.address);
      }
    }
  }
  return [...new Set(ips)];
}

export function formatLanUrls({ vitePort, serverPort, host = 'localhost' } = {}) {
  const connectable = host === '0.0.0.0' || host === '::' ? 'localhost' : host;
  const urls = [
    { label: '本机', vite: `http://${connectable}:${vitePort}`, server: `http://${connectable}:${serverPort}` },
  ];
  for (const ip of listLanIPv4()) {
    urls.push({
      label: `局域网 ${ip}`,
      vite: `http://${ip}:${vitePort}`,
      server: `http://${ip}:${serverPort}`,
    });
  }
  return urls;
}
