
const COMMON_TYPOS = {

  'bangalore': ['bangalore', 'bengaluru', 'bangalor', 'bangaluru'],
  'bengaluru': ['bengaluru', 'bangalore', 'bangaluru'],
  

  'koramangala': ['koramangala', 'koramangla', 'kormangala', 'koramangla'],
  'indiranagar': ['indiranagar', 'indira nagar', 'indira nagar', 'indiranagr'],
  'whitefield': ['whitefield', 'white field', 'whitefild'],
  'marathahalli': ['marathahalli', 'marathahali', 'marathalli'],
  'hebbal': ['hebbal', 'hebbel', 'hebal'],
  'hosur': ['hosur', 'hosur road', 'hosur rd'],
  'mysore': ['mysore', 'mysuru', 'mysor'],
  'airport': ['airport', 'kia', 'kempegowda', 'kempegowda international airport'],
  

  'mg road': ['mg road', 'm g road', 'mahatma gandhi road', 'mg rd'],
  'brigade road': ['brigade road', 'brigade rd', 'brigade'],
  'commercial street': ['commercial street', 'commercial st', 'commercial'],
  

  'mall': ['mall', 'shopping mall', 'shopping center', 'shopping centre'],
  'hospital': ['hospital', 'hospitals'],
  'school': ['school', 'schools'],
  'college': ['college', 'colleges'],
  'hotel': ['hotel', 'hotels'],
  'restaurant': ['restaurant', 'restaurants', 'restro'],
};

function normalizeQuery(query) {
  if (!query) return '';
  
  return query
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '')
    .trim();
}

function levenshteinDistance(str1, str2) {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix = [];

  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + 1
        );
      }
    }
  }

  return matrix[len1][len2];
}

function similarity(str1, str2) {
  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return 1;
  const distance = levenshteinDistance(str1, str2);
  return 1 - (distance / maxLen);
}

function getTypoCorrections(query) {
  const normalized = normalizeQuery(query);
  const corrections = new Set([normalized]);

  for (const [correct, variations] of Object.entries(COMMON_TYPOS)) {
    if (variations.includes(normalized)) {
      corrections.add(correct);
      variations.forEach(v => corrections.add(v));
    }
  }

  for (const [correct, variations] of Object.entries(COMMON_TYPOS)) {
    for (const variation of variations) {
      const sim = similarity(normalized, variation);
      if (sim > 0.7) {
        corrections.add(correct);
        variations.forEach(v => corrections.add(v));
      }
    }
  }

  return Array.from(corrections);
}

function generateQueryVariations(query) {
  const normalized = normalizeQuery(query);
  const variations = new Set([normalized, query]);

  const corrections = getTypoCorrections(normalized);
  corrections.forEach(c => variations.add(c));

  const words = normalized.split(' ');
  if (words.length > 0) {
    const lastWord = words[words.length - 1];
    

    if (lastWord.endsWith('road') || lastWord.endsWith('rd')) {
      variations.add(normalized.replace(/road|rd$/i, 'road'));
      variations.add(normalized.replace(/road|rd$/i, 'rd'));
    }
    if (lastWord.endsWith('street') || lastWord.endsWith('st')) {
      variations.add(normalized.replace(/street|st$/i, 'street'));
      variations.add(normalized.replace(/street|st$/i, 'st'));
    }
    if (lastWord.endsWith('nagar') || lastWord.endsWith('nagar')) {
      variations.add(normalized.replace(/nagar$/i, 'nagar'));
    }
  }

  if (normalized.includes('mg') || normalized.includes('m g')) {
    variations.add(normalized.replace(/m\s*g|mg/gi, 'mahatma gandhi'));
    variations.add(normalized.replace(/m\s*g|mg/gi, 'mg'));
  }

  return Array.from(variations).slice(0, 5);
}

function fuzzyMatch(query, placeName) {
  if (!query || !placeName) return 0;

  const normalizedQuery = normalizeQuery(query);
  const normalizedPlace = normalizeQuery(placeName);

  if (normalizedPlace === normalizedQuery) return 1;

  if (normalizedPlace.includes(normalizedQuery) || normalizedQuery.includes(normalizedPlace)) {
    return 0.9;
  }

  const queryWords = normalizedQuery.split(' ').filter(w => w.length > 2);
  const placeWords = normalizedPlace.split(' ').filter(w => w.length > 2);
  
  if (queryWords.length > 0 && placeWords.length > 0) {
    let matchedWords = 0;
    for (const qWord of queryWords) {
      for (const pWord of placeWords) {
        if (pWord.includes(qWord) || qWord.includes(pWord)) {
          matchedWords++;
          break;
        }
      }
    }
    if (matchedWords > 0) {
      return 0.7 + (matchedWords / queryWords.length) * 0.2;
    }
  }

  return similarity(normalizedQuery, normalizedPlace);
}

module.exports = {
  normalizeQuery,
  levenshteinDistance,
  similarity,
  getTypoCorrections,
  generateQueryVariations,
  fuzzyMatch,
};
