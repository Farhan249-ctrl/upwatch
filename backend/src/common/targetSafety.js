const dns = require('dns').promises;
const net = require('net');

function createValidationError(message) {
  const err = new Error(message);
  err.statusCode = 400;
  return err;
}

function ipv4ToInt(ip) {
  return ip.split('.').reduce((acc, octet) => ((acc << 8) + parseInt(octet, 10)) >>> 0, 0);
}

function isLinkLocalIPv4(ip) {
  const intVal = ipv4ToInt(ip);
  // 169.254.0.0/16
  const start = ipv4ToInt('169.254.0.0');
  const end = ipv4ToInt('169.254.255.255');
  return intVal >= start && intVal <= end;
}

function isLoopbackIPv4(ip) {
  const intVal = ipv4ToInt(ip);
  // 127.0.0.0/8
  const start = ipv4ToInt('127.0.0.0');
  const end = ipv4ToInt('127.255.255.255');
  return intVal >= start && intVal <= end;
}

function isPrivateIPv4(ip) {
  const intVal = ipv4ToInt(ip);
  // 10.0.0.0/8
  if (intVal >= ipv4ToInt('10.0.0.0') && intVal <= ipv4ToInt('10.255.255.255')) return true;
  // 172.16.0.0/12
  if (intVal >= ipv4ToInt('172.16.0.0') && intVal <= ipv4ToInt('172.31.255.255')) return true;
  // 192.168.0.0/16
  if (intVal >= ipv4ToInt('192.168.0.0') && intVal <= ipv4ToInt('192.168.255.255')) return true;
  // 100.64.0.0/10
  if (intVal >= ipv4ToInt('100.64.0.0') && intVal <= ipv4ToInt('100.127.255.255')) return true;
  // 0.0.0.0/8
  if (intVal >= ipv4ToInt('0.0.0.0') && intVal <= ipv4ToInt('0.255.255.255')) return true;
  return false;
}

function isLinkLocalIPv6(ip) {
  const lower = ip.toLowerCase();
  return lower.startsWith('fe80:');
}

function isLoopbackIPv6(ip) {
  const lower = ip.toLowerCase();
  return lower === '::1';
}

function isPrivateIPv6(ip) {
  const lower = ip.toLowerCase();
  // fc00::/7 (fc00... or fd00...)
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
  if (lower === '::') return true;
  return false;
}

function normalizeIP(ip) {
  if (ip.startsWith('::ffff:')) {
    const v4 = ip.replace('::ffff:', '');
    if (net.isIPv4(v4)) return { ip: v4, family: 4 };
  }
  return { ip, family: net.isIP(ip) };
}

async function validateTargetUrl(urlString, allowPrivateTargets = false) {
  let parsed;
  try {
    parsed = new URL(urlString);
  } catch {
    throw createValidationError('Invalid URL format');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw createValidationError('Target URL must use HTTP or HTTPS protocol');
  }

  const hostname = parsed.hostname;
  if (!hostname) {
    throw createValidationError('Target URL hostname is required');
  }

  // Handle localhost explicitly
  if (hostname.toLowerCase() === 'localhost') {
    if (!allowPrivateTargets) {
      throw createValidationError('Target hostname localhost is not permitted');
    }
  }

  // Resolve hostname
  let addresses = [];
  try {
    addresses = await dns.lookup(hostname, { all: true });
  } catch (err) {
    throw createValidationError(`Cannot resolve target hostname '${hostname}': ${err.message}`);
  }

  if (!addresses || addresses.length === 0) {
    throw createValidationError(`Target hostname '${hostname}' resolved to no addresses`);
  }

  for (const item of addresses) {
    const { ip, family } = normalizeIP(item.address);

    if (family === 4) {
      // 169.254.0.0/16 is ALWAYS blocked
      if (isLinkLocalIPv4(ip)) {
        throw createValidationError(`Target IP ${ip} (169.254.0.0/16 link-local/cloud metadata) is strictly blocked`);
      }

      if (!allowPrivateTargets) {
        if (isLoopbackIPv4(ip)) {
          throw createValidationError(`Target IP ${ip} (loopback) is blocked when private targets are disabled`);
        }
        if (isPrivateIPv4(ip)) {
          throw createValidationError(`Target IP ${ip} (private network) is blocked when private targets are disabled`);
        }
      }
    } else if (family === 6) {
      // fe80::/10 link-local is ALWAYS blocked
      if (isLinkLocalIPv6(ip)) {
        throw createValidationError(`Target IPv6 ${ip} (fe80::/10 link-local) is strictly blocked`);
      }

      if (!allowPrivateTargets) {
        if (isLoopbackIPv6(ip)) {
          throw createValidationError(`Target IPv6 ${ip} (loopback) is blocked when private targets are disabled`);
        }
        if (isPrivateIPv6(ip)) {
          throw createValidationError(`Target IPv6 ${ip} (private network) is blocked when private targets are disabled`);
        }
      }
    }
  }

  return { valid: true, parsed, addresses };
}

module.exports = {
  validateTargetUrl,
  isLinkLocalIPv4,
  isLoopbackIPv4,
  isPrivateIPv4,
};
