// The push address is written by any signed-in device, so the server that POSTs
// to it must refuse addresses that live inside its own network.

/** https only, and no loopback / private / link-local address literals — those are
 *  the addresses a Cloud Function should never be turned into a courier for. */
function endpointBisaDikirim(endpoint, bolehLokal) {
  let url;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:') return false;
  if (bolehLokal) return true;
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (host === 'localhost' || /\.(internal|local|localdomain)$/.test(host)) return false;
  if (/^(0|10|127)(\.|$)/.test(host) || /^(192\.168|169\.254)\./.test(host)) return false;
  if (/^172\.(1[6-9]|2\d|3[01])(\.|$)/.test(host)) return false;
  if (host === '::1' || /^(fe80|f[cd]|fe)[0-9a-f]*:/.test(host)) return false;
  return true;
}

module.exports = { endpointBisaDikirim };
