/**
 * Utilitário Avançado de Busca Inteligente e Decomposição de Códigos de Barras Hospitalares
 * 
 * Suporta:
 * 1. Códigos compostos com múltiplos números em um único código de barras (GS1, HIBCC, DataMatrix, 1D).
 * 2. Busca específica por IDEC (Identificação do Equipamento / Tag: ex: "CCHL-0075").
 * 3. Busca específica por Número de Série (ex: "2104010003").
 * 4. Extração automática de substrings, tokens e números contidos dentro de um código longo.
 */

/**
 * Extrai apenas números de uma string
 */
export function extractDigits(str) {
  if (!str) return '';
  return String(str).replace(/\D/g, '');
}

/**
 * Normaliza string removendo pontuações, espaços e caracteres especiais
 */
export function cleanAlphanumeric(str) {
  if (!str) return '';
  return String(str)
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]/g, '');
}

/**
 * Extrai todos os tokens, números e segmentos contidos dentro de um código composto longo
 */
export function extractTokensFromBarcode(rawCode) {
  if (!rawCode) return [];
  const text = String(rawCode).trim();
  const tokens = new Set();

  // 1. O código completo limpo
  const cleanFull = cleanAlphanumeric(text);
  if (cleanFull) tokens.add(cleanFull);

  // 2. Extração de Application Identifiers GS1: (01), (21), (8004), etc.
  const aiMatches = text.matchAll(/\((\d{2,4})\)([^()]+)/g);
  for (const m of aiMatches) {
    const val = cleanAlphanumeric(m[2]);
    if (val) tokens.add(val);
  }

  // 3. Padrão GS1 DataMatrix plano: 01 + 14 dígitos GTIN + 21 + Serial
  const gs1FlatMatch = text.match(/01(\d{14})21([A-Za-z0-9]+)/);
  if (gs1FlatMatch) {
    const serial = gs1FlatMatch[2].split(/(?:17\d{6}|10[A-Za-z0-9]+)/)[0];
    if (serial) tokens.add(cleanAlphanumeric(serial));
  }

  // 4. Divisão por separadores comuns: espaços, barras, traços, pontos, ponto-e-vírgula, vírgulas, quebras de linha
  const parts = text.split(/[\s\/\;\,\.\|\_\-\:\(\)\[\]]+/);
  for (const p of parts) {
    const c = cleanAlphanumeric(p);
    if (c.length >= 3) {
      tokens.add(c);
    }
  }

  // 5. Extração de todas as sequências de números com 4 ou mais dígitos
  const digitSequences = text.match(/\d{4,}/g) || [];
  for (const seq of digitSequences) {
    tokens.add(seq);
  }

  return Array.from(tokens);
}

/**
 * Encontra o comprimento da maior sequência contígua de caracteres ou dígitos em comum
 */
export function longestCommonSubstringLength(s1, s2) {
  if (!s1 || !s2) return 0;
  const n = s1.length;
  const m = s2.length;
  let maxLen = 0;
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
        if (dp[i][j] > maxLen) {
          maxLen = dp[i][j];
        }
      }
    }
  }
  return maxLen;
}

/**
 * Distância de Levenshtein para calcular proximidade geral de strings
 */
export function levenshteinDistance(s1, s2) {
  if (!s1) return s2 ? s2.length : 0;
  if (!s2) return s1.length;

  const m = s1.length;
  const n = s2.length;
  const dp = Array.from({ length: m + 1 }, () => new Uint16Array(n + 1));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}

/**
 * Avalia se o campo da bomba está contido ou coincide com o código lido ou algum dos seus tokens
 */
function evaluateFieldMatch(scannedRaw, fieldRaw, tokens = []) {
  if (!scannedRaw || !fieldRaw) return { score: 0, reason: '', confidence: 0, matchingDigits: 0, matchedSnippet: '' };

  const scannedStr = String(scannedRaw).trim();
  const fieldStr = String(fieldRaw).trim();

  const scannedClean = cleanAlphanumeric(scannedStr);
  const fieldClean = cleanAlphanumeric(fieldStr);

  const scannedDigits = extractDigits(scannedStr);
  const fieldDigits = extractDigits(fieldStr);

  // 1. Coincidência Exata Absoluta (100% de confiança)
  if (scannedClean === fieldClean && scannedClean.length > 0) {
    return {
      score: 1100,
      confidence: 100,
      matchingDigits: scannedDigits.length,
      matchedSnippet: fieldStr,
      reason: 'Correspondência 100% Exata'
    };
  }

  // 2. Token exato extraído de código composto (ex: "CCHL-0075" ou "2104010003" dentro de um código longo)
  for (const t of tokens) {
    if (t === fieldClean && fieldClean.length >= 3) {
      return {
        score: 1050 + fieldClean.length,
        confidence: 100,
        matchingDigits: fieldDigits.length,
        matchedSnippet: fieldStr,
        reason: `Encontrado exatamente no código composto: "${fieldStr}"`
      };
    }
  }

  // 3. Contenção Direta: O código longo lido CONTÉM o campo do equipamento (ex: código de barras tem 40 caracteres e inclui a série)
  if (fieldClean.length >= 4 && scannedClean.includes(fieldClean)) {
    return {
      score: 1000 + fieldClean.length,
      confidence: 99,
      matchingDigits: fieldDigits.length,
      matchedSnippet: fieldStr,
      reason: `"${fieldStr}" localizado dentro do código de barras composto`
    };
  }

  // 4. O campo da planilha CONTÉM o código lido
  if (scannedClean.length >= 4 && fieldClean.includes(scannedClean)) {
    const ratio = Math.round((scannedClean.length / fieldClean.length) * 100);
    return {
      score: 950 + scannedClean.length,
      confidence: Math.max(ratio, 92),
      matchingDigits: Math.min(scannedDigits.length, fieldDigits.length),
      matchedSnippet: scannedStr,
      reason: `Código lido faz parte do cadastro (${scannedClean.length} caracteres)`
    };
  }

  // 5. Comparação de Dígitos Numéricos (Números de Série)
  if (scannedDigits.length >= 4 && fieldDigits.length >= 4) {
    // 5a. A sequência inteira de dígitos está contida no código
    if (scannedDigits.includes(fieldDigits)) {
      return {
        score: 980 + fieldDigits.length,
        confidence: 98,
        matchingDigits: fieldDigits.length,
        matchedSnippet: fieldDigits,
        reason: `Todos os ${fieldDigits.length} dígitos do número de série estão no código de barras`
      };
    }
    if (fieldDigits.includes(scannedDigits)) {
      return {
        score: 940 + scannedDigits.length,
        confidence: 94,
        matchingDigits: scannedDigits.length,
        matchedSnippet: scannedDigits,
        reason: `${scannedDigits.length} dígitos lidos conferem com o cadastro`
      };
    }

    // 5b. Maior sequência contígua de números idênticos
    const commonDigits = longestCommonSubstringLength(scannedDigits, fieldDigits);
    const maxDigits = Math.max(scannedDigits.length, fieldDigits.length);

    if (commonDigits >= 4) {
      const ratio = commonDigits / maxDigits;
      const confidence = Math.round(ratio * 100);
      const score = Math.round(ratio * 700) + (commonDigits * 15);

      if (confidence >= 60 || commonDigits >= 6) {
        return {
          score,
          confidence: Math.min(confidence, 94),
          matchingDigits: commonDigits,
          matchedSnippet: fieldDigits.substring(0, commonDigits),
          reason: `${commonDigits} números sequenciais idênticos (${confidence}% similar)`
        };
      }
    }
  }

  // 6. Proximidade por distância de Levenshtein (erros de digitação ou leitura levemente corrompida)
  if (scannedClean.length >= 5 && fieldClean.length >= 5) {
    const dist = levenshteinDistance(scannedClean, fieldClean);
    const maxLen = Math.max(scannedClean.length, fieldClean.length);
    const similarity = 1 - (dist / maxLen);

    if (similarity >= 0.70) {
      const confidence = Math.round(similarity * 100);
      return {
        score: Math.round(similarity * 600),
        confidence,
        matchingDigits: Math.max(0, maxLen - dist),
        matchedSnippet: fieldStr,
        reason: `Aproximado com ${confidence}% de similaridade`
      };
    }
  }

  return { score: 0, confidence: 0, matchingDigits: 0, matchedSnippet: '', reason: '' };
}

/**
 * Encontra os melhores candidatos de equipamentos para o código de barras lido.
 * 
 * @param {string} scannedCode - Texto ou código de barras lido (simples ou composto)
 * @param {Array} equipments - Lista de equipamentos do hospital
 * @param {string} searchTarget - 'all' (automático) | 'idec' (somente Identificação/Tag) | 'serie' (somente Série)
 * @returns {Array} Lista de candidatos ordenados por relevância
 */
export function findBestEquipmentMatches(scannedCode, equipments = [], searchTarget = 'all') {
  if (!scannedCode || !Array.isArray(equipments) || equipments.length === 0) {
    return [];
  }

  const cleanScan = String(scannedCode).trim();
  if (cleanScan.length < 2) return [];

  // Extrai todos os tokens e substrings do código lido
  const tokens = extractTokensFromBarcode(cleanScan);
  const candidates = [];

  for (let i = 0; i < equipments.length; i++) {
    const item = equipments[i];
    let bestFieldMatch = { score: 0, confidence: 0, matchingDigits: 0, matchedSnippet: '', reason: '', field: '' };

    // Define quais campos testar de acordo com o modo escolhido
    const testFields = [];

    // Campos de IDEC / Identificação / Tag
    if (searchTarget === 'all' || searchTarget === 'idec') {
      testFields.push(
        { name: 'IDEC / Tag', value: item.tag },
        { name: 'Identificação Original', value: item._originalRow?.['Identificação'] || item._originalRow?.['Identificacao'] },
        { name: 'ID do Sistema', value: item.id },
        { name: 'Patrimônio', value: item.patrimonio || item._originalRow?.['Patrimônio'] || item._originalRow?.['Tombamento'] }
      );
    }

    // Campos de Número de Série
    if (searchTarget === 'all' || searchTarget === 'serie') {
      testFields.push(
        { name: 'Número de Série', value: item.serie },
        { name: 'Série Original', value: item._originalRow?.['Número de Série'] || item._originalRow?.['Numero de Serie'] },
        { name: 'Código de Barras', value: item.codigoBarras }
      );
    }

    // Avalia cada campo para este equipamento
    for (const tf of testFields) {
      if (!tf.value) continue;
      const res = evaluateFieldMatch(cleanScan, tf.value, tokens);
      if (res.score > bestFieldMatch.score) {
        bestFieldMatch = {
          ...res,
          field: tf.name,
          fieldValue: String(tf.value)
        };
      }
    }

    // Se encontrou similaridade suficiente
    if (bestFieldMatch.score >= 400 || bestFieldMatch.confidence >= 50) {
      candidates.push({
        equipment: item,
        score: bestFieldMatch.score,
        confidence: bestFieldMatch.confidence,
        matchingDigits: bestFieldMatch.matchingDigits,
        matchedField: bestFieldMatch.field,
        matchedValue: bestFieldMatch.fieldValue,
        matchedSnippet: bestFieldMatch.matchedSnippet,
        reason: bestFieldMatch.reason,
        isExact: bestFieldMatch.confidence >= 99
      });
    }
  }

  // Ordena pelo maior score (mais específico e com maior proximidade)
  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.matchingDigits !== a.matchingDigits) return b.matchingDigits - a.matchingDigits;
    if (a.equipment.checado !== b.equipment.checado) {
      return a.equipment.checado ? 1 : -1;
    }
    return 0;
  });

  return candidates;
}
