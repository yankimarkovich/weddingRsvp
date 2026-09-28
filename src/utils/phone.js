// Normalizes Israeli phone numbers to a consistent local format (05XXXXXXXX)
// used as the unique key for guests, and provides an international variant for SMS providers.
function normalizeLocal(rawPhone) {
  const digits = String(rawPhone).replace(/\D/g, '');
  if (digits.startsWith('972')) return '0' + digits.slice(3);
  if (digits.startsWith('0')) return digits;
  return digits;
}

function toInternational(rawPhone) {
  const local = normalizeLocal(rawPhone);
  return local.startsWith('0') ? '972' + local.slice(1) : local;
}

function isValidIsraeliMobile(rawPhone) {
  return /^05\d{8}$/.test(normalizeLocal(rawPhone));
}

module.exports = { normalizeLocal, toInternational, isValidIsraeliMobile };
