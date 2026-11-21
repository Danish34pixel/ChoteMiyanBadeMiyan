import dns from 'node:dns';

export const mongoDnsServers = ['8.8.8.8', '8.8.4.4'];

export function configureDns() {
  dns.setServers(mongoDnsServers);
}
