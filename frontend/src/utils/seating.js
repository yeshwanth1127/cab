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

  // Use fixed seat counts for TT and MiniBus.
  if (isTempoTraveller) return '11+1';
  if (isMiniBus) return '9+1';

  // Default for other car types
  return '6+1';
}


