/**
 * gs1Parser.js
 * 
 * Parser especializado em Códigos de Barras Hospitalares Compostos (GS1-128, DataMatrix, Code 128)
 * e Extração Inteligente de Número de Série (AI 21) descartando GTIN (01) e Lote (10).
 */

/**
 * Remove prefixos de simbologia de código de barras (AIM identifiers)
 * ]C1 = GS1-128, ]e0 = EAN, ]d2 = GS1 DataMatrix, ]Q3 = GS1 QR Code
 */
export function stripAimIdentifier(str) {
  if (!str) return '';
  return str.replace(/^\][A-Za-z0-9]{2}/, '');
}

/**
 * Decompõe um código de barras composto em seus elementos GS1 individuais
 * 
 * Exemplo de entrada:
 * "(01) 04987350735102 (10) 210901 (21) 2109010096"
 * ou "010498735073510210210901212109010096"
 * ou "010498735073510210210901\u001d212109010096"
 * ou "[REF] TE*LM835A07 [SN] 2109010096"
 * 
 * @param {string} rawInput 
 * @returns {{
 *   isGS1: boolean,
 *   raw: string,
 *   serialNumber: string | null,
 *   gtin: string | null,
 *   lote: string | null,
 *   ref: string | null,
 *   allCandidates: string[]
 * }}
 */
export function parseCompositeBarcode(rawInput) {
  if (!rawInput) {
    return { isGS1: false, raw: '', serialNumber: null, gtin: null, lote: null, ref: null, allCandidates: [] };
  }

  const raw = String(rawInput).trim();
  const cleanedInput = stripAimIdentifier(raw);
  const candidatesSet = new Set();

  let gtin = null;
  let lote = null;
  let serialNumber = null;
  let ref = null;
  let isGS1 = false;

  // 1. Extração por rótulos textuais comuns (ex: [SN] 2109010096 ou [REF] TE*LM835A07)
  const snLabelMatch = cleanedInput.match(/(?:\[SN\]|SN:|NS:|S\/N:|N\/S:|SERIAL:?)\s*([A-Za-z0-9\-\.\/]+)/i);
  if (snLabelMatch && snLabelMatch[1]) {
    serialNumber = snLabelMatch[1].trim();
    candidatesSet.add(serialNumber);
  }

  const refLabelMatch = cleanedInput.match(/(?:\[REF\]|REF:|MODEL:|MODELO:)\s*([A-Za-z0-9\*\-\.\/]+)/i);
  if (refLabelMatch && refLabelMatch[1]) {
    ref = refLabelMatch[1].trim();
    candidatesSet.add(ref);
  }

  // 2. Extração GS1 com Parênteses: (01) ..., (10) ..., (21) ...
  if (cleanedInput.includes('(') && cleanedInput.includes(')')) {
    isGS1 = true;
    const aiRegex = /\((\d{2,4})\)\s*([^()]+)/g;
    let match;
    while ((match = aiRegex.exec(cleanedInput)) !== null) {
      const ai = match[1];
      const rawVal = match[2].trim();
      // O valor do AI termina no final da linha ou antes de palavras adicionais de outros rótulos
      const firstLine = rawVal.split(/[\r\n]+/)[0].trim();
      const val = firstLine.split(/\s+/)[0].replace(/[^A-Za-z0-9\-\.\/]/g, '');

      if (!val) continue;

      if (ai === '21') {
        // AI 21 é SEMPRE o Número de Série no padrão GS1 internacional
        serialNumber = val;
        candidatesSet.add(val);
      } else if (ai === '01' || ai === '02') {
        // AI 01 é GTIN / Código do Produto (14 dígitos)
        gtin = val;
        candidatesSet.add(val);
      } else if (ai === '10') {
        // AI 10 é Lote / Data de Fabricação
        lote = val;
        candidatesSet.add(val);
      } else {
        candidatesSet.add(val);
      }
    }
  }

  // 3. Extração GS1 com Separador de Grupo ASCII 29 (\u001d ou \x1d)
  if (!serialNumber && (cleanedInput.includes('\u001d') || cleanedInput.includes('\x1d'))) {
    isGS1 = true;
    const parts = cleanedInput.split(/[\u001d\x1d]+/);
    for (const part of parts) {
      const p = part.trim();
      if (p.startsWith('21')) {
        serialNumber = p.substring(2);
        candidatesSet.add(serialNumber);
      } else if (p.startsWith('01') && p.length >= 16) {
        gtin = p.substring(2, 16);
        candidatesSet.add(gtin);
        // O restante pode conter outro AI
        const rest = p.substring(16);
        if (rest.startsWith('21')) {
          serialNumber = rest.substring(2);
          candidatesSet.add(serialNumber);
        } else if (rest.startsWith('10')) {
          lote = rest.substring(2);
          candidatesSet.add(lote);
        }
      } else if (p.startsWith('10')) {
        lote = p.substring(2);
        candidatesSet.add(lote);
      }
    }
  }

  // 4. Extração GS1 Plano (sem parênteses e sem separador especial)
  // Formato típico Terumo: 01 + 14 dígitos GTIN + 10 + Lote + 21 + Serial
  const cleanDigitsOnly = cleanedInput.replace(/\D/g, '');

  if (!serialNumber && cleanDigitsOnly.length >= 20) {
    // Procura por padrão 01 + 14 dígitos GTIN
    if (cleanDigitsOnly.startsWith('01') && cleanDigitsOnly.length >= 16) {
      isGS1 = true;
      gtin = cleanDigitsOnly.substring(2, 16);
      candidatesSet.add(gtin);

      const afterGtin = cleanDigitsOnly.substring(16);

      // Padrão A: após GTIN vem direto 21 (Serial)
      if (afterGtin.startsWith('21')) {
        serialNumber = afterGtin.substring(2);
        candidatesSet.add(serialNumber);
      } 
      // Padrão B: após GTIN vem 10 (Lote, tipicamente 6 a 8 dígitos) e depois 21 (Serial)
      else if (afterGtin.startsWith('10')) {
        const after10 = afterGtin.substring(2);
        // O lote da Terumo costuma ser YYMMDD (6 dígitos) ou 8 dígitos
        // Procuramos por '21' que indica o início do serial (a partir da posição 4 para não confundir com lote começando em 21)
        const idx21 = after10.indexOf('21', 4);
        if (idx21 !== -1 && idx21 <= 12) {
          lote = after10.substring(0, idx21);
          serialNumber = after10.substring(idx21 + 2);
          candidatesSet.add(lote);
          candidatesSet.add(serialNumber);
        } else {
          // Fallback: assume lote de 6 dígitos (YYMMDD)
          lote = after10.substring(0, 6);
          const rem = after10.substring(6);
          candidatesSet.add(lote);
          if (rem.startsWith('21')) {
            serialNumber = rem.substring(2);
            candidatesSet.add(serialNumber);
          } else {
            serialNumber = rem;
            candidatesSet.add(serialNumber);
          }
        }
      }
    }

    // Procura por ocorrência isolada de "21" seguido de 8 a 12 dígitos
    if (!serialNumber) {
      const match21 = cleanDigitsOnly.match(/(?:^|[^\d])21(\d{8,12})(?:$|[^\d])/);
      if (match21 && match21[1]) {
        serialNumber = match21[1];
        candidatesSet.add(serialNumber);
      }
    }
  }

  // 5. Extração de sequências numéricas de 8 a 12 dígitos (típicas de bombas médicas)
  const numberRuns = cleanedInput.match(/\b\d{8,12}\b/g) || [];
  for (const n of numberRuns) {
    candidatesSet.add(n);
    if (!serialNumber) {
      serialNumber = n;
    }
  }

  // 6. Extração de padrões de TAG hospitalar (ex: UTIPHL-0047, CCHL-0075)
  const tagMatches = cleanedInput.match(/\b[A-Za-z]{2,8}\s*-\s*\d{3,6}\b/g) || [];
  for (const t of tagMatches) {
    candidatesSet.add(t.replace(/\s+/g, ''));
  }

  // Adiciona a string inteira limpa
  const fullClean = cleanedInput.replace(/[^A-Za-z0-9]/g, '');
  if (fullClean) candidatesSet.add(fullClean);

  return {
    isGS1,
    raw,
    serialNumber,
    gtin,
    lote,
    ref,
    allCandidates: Array.from(candidatesSet)
  };
}

/**
 * Função inteligente que recebe qualquer código lido e tenta extrair especificamente
 * o número de série mais provável.
 * 
 * @param {string} code 
 * @returns {string} Código limpo do número de série
 */
export function extractCleanSerialNumber(code) {
  if (!code) return '';
  const parsed = parseCompositeBarcode(code);
  if (parsed.serialNumber) {
    return parsed.serialNumber;
  }
  // Se não encontrou formato GS1 específico, retorna o código original limpo
  return String(code).trim();
}

