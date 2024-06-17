import { networkInterfaces } from "os";

export function getRandomNumber(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function getNetworkIpAddress() {
  const interfaces = networkInterfaces();
  let ipList = [];

  for (const iface in interfaces) {
    for (const address of interfaces[iface] || []) {
      if (address.family === "IPv4") {
        ipList.push(address.address);
      }
    }
  }

  const address = ipList.find((ip) => ip.startsWith("192."));
  return address || null;
}
