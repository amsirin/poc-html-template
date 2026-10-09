// Exact two-decimal string formatting; no money calculation or rounding.
export function formatAmount(value) {
  const [integer, fraction] = value.split('.');
  return `${integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${fraction}`;
}

