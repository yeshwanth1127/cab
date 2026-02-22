export function getSeatLabel({ cabTypeName, seatingCapacity, crystaSeater }) {
  const name = String(cabTypeName || '').trim();
  const lower = name.toLowerCase();

  const parsePlusOneFromName = () => {
    const m = lower.match(/(\d+)\s*\+\s*1/);
    if (!m) return null;
    const n = Number(m[1]);
    if (!Number.isFinite(n) || n < 1) return null;
    return `${n}+1`;
  };

  const isSedan = /\bsedan\b/.test(lower);
  const isCrysta = /crysta/.test(lower);
  const isSuv = /\bsuv\b/.test(lower);
  const isTempoTraveller = /\btt\b/.test(lower) || /tempo\s*travell?er/.test(lower) || /\btravell?er\b/.test(lower);
  const isMiniBus = /mini\s*bus/.test(lower) || /\bminibus\b/.test(lower);

  if (isSedan) return '4+1';
  if (isCrysta) return crystaSeater || '7+1';
  if (isSuv) return '6+1';

  // Do not force TT / MiniBus into the default 6+1 bucket.
  if (isTempoTraveller || isMiniBus) {
    const total = Number(seatingCapacity);
    if (Number.isFinite(total) && total >= 2) return `${total - 1}+1`;
    return parsePlusOneFromName();
  }

  // Default for other car types
  return '6+1';
}


