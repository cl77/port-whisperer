/**
 * Shared helpers for parsing listen addresses from lsof / ss / netstat.
 */

const WILDCARDS = new Set(["*", "0.0.0.0", "::", ""]);

/**
 * Extract the bind host from "host:port" (e.g. "[::1]:3006", "*:3006",
 * ":::3006", "127.0.0.53%lo:53"). Wildcard binds are returned as "*".
 */
export function parseListenHost(localAddr) {
  let host = localAddr.replace(/:\d+$/, "");
  host = host.replace(/^\[(.*)\]$/, "$1").replace(/%.*$/, "");
  host = host.replace(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i, "$1");
  return WILDCARDS.has(host) ? "*" : host;
}

/**
 * Collect listener rows into one entry per (port, pid), keeping every
 * bind address so two processes sharing a port on different hosts both show up.
 */
export function createEntryCollector() {
  const byKey = new Map();
  const entries = [];
  return {
    entries,
    add(port, pid, processName, address) {
      const key = `${port}:${pid}`;
      const existing = byKey.get(key);
      if (existing) {
        if (!existing.addresses.includes(address)) {
          existing.addresses.push(address);
        }
        return;
      }
      const entry = { port, pid, processName, addresses: [address] };
      byKey.set(key, entry);
      entries.push(entry);
    },
  };
}

const LOCALHOST_TARGETS = ["127.0.0.1", "::1"];

/**
 * Pick the host a browser must use to reach this listener. `contested` holds
 * the bind addresses of other processes on the same port.
 */
export function pickLinkHost(addresses, contested) {
  const loopback = LOCALHOST_TARGETS.find((a) => addresses.includes(a));
  const wildcard = addresses.includes("*");

  if (contested.length === 0) {
    return wildcard || loopback ? "localhost" : addresses[0];
  }
  if (loopback) return loopback;
  if (wildcard) {
    return LOCALHOST_TARGETS.find((a) => !contested.includes(a)) || "127.0.0.1";
  }
  return addresses[0];
}
