/**
 * serialAgent.js
 * 
 * Agente de Inteligência para extração de Números de Série (NS / SN)
 * e Tags de Identificação (IDEC) a partir de texto OCR de fotos de etiquetas.
 */

import { findBestEquipmentMatches } from './fuzzyMatch.js';

// Prefixos e siglas comuns de número de série e identificação médica
const SERIAL_PREFIX_PATTERNS = [
  // NS variações: NS, N/S, N.S., N° S, Nº S, NS:, N/S:
  /(?:^|[\s,;:\(\)\[\]])(?:N\s*[\/\.]?\s*S|N[º°]?\s*S[EÉ]RIE|N[º°]?\s*S|NUMBER\s+SERIAL|SERIAL\s+NUMBER|SERIAL|S[EÉ]RIE|SN|S\s*[\/\.]?\s*N|S\/NO|S\.NO|SER\.?\s*NO|SER\.?)\s*[:=\-#\.]?\s*([A-Z0-9\-\.\/]{4,25})/gi,
  
  // IDEC e TAG variações: IDEC, IDEC:, TAG, TAG:, IDENTIFICAÇÃO, IDENTIFICACAO
  /(?:^|[\s,;:\(\)\[\]])(?:IDEC|TAG|IDENTIFICA[CÇ][AÃ]O|PATRIM[OÔ]NIO|PATR|EQP|BOMBA|C[OÓ]DIGO)\s*[:=\-#\.]?\s*([A-Z0-9\-\.\/]{4,25})/gi,

  // Padrão específico para formato IDEC hospitalar (ex: CCHL-0075, UTI-012, etc.)
  /(?:^|[\s,;:\(\)\[\]])([A-Z]{2,6}\s*-\s*[0-9]{3,6})/gi,

  // Padrões de números de série típicos de bombas de infusão (sequência de 8 a 12 dígitos, ex: 2104010003, 2006010178)
  /(?:^|[\s,;:\(\)\[\]])([0-9]{8,12})(?:$|[\s,;:\(\)\[\]])/g
];

/**
 * Limpa e padroniza um token extraído
 */
function sanitizeToken(token) {
  if (!token) return '';
  return token
    .trim()
    .replace(/^[:=\-#\.\s]+/, '')
    .replace(/[:=\-#\.\s]+$/, '')
    .replace(/\s+/g, '');
}

/**
 * Extrai candidatos a número de série e códigos de um texto cru (OCR)
 * @param {string} rawText Texto bruto extraído da foto
 * @returns {Array<{ token: string, label: string, confidence: number }>}
 */
export function extractSerialCandidates(rawText) {
  if (!rawText || typeof rawText !== 'string') return [];

  const candidatesMap = new Map();

  const addCandidate = (rawToken, label, confidence) => {
    const clean = sanitizeToken(rawToken);
    if (!clean || clean.length < 3) return;
    
    // Ignora palavras comuns de etiquetas em inglês/português
    const ignoredWords = new Set([
      'VOLTS', 'WATTS', 'TERUMO', 'BRAUN', 'SAMTRONIC', 'EQUIPAMENTO', 
      'MADE', 'JAPAN', 'BRAZIL', 'CHINA', 'MODEL', 'MODELO', 'POWER',
      'INPUT', 'OUTPUT', 'SERIAL', 'NUMBER', 'SERIE', 'DATE', 'DATA',
      'VAL', 'VALIDADE', 'FAB', 'FABRICACAO', 'CORRENTE', 'FREQ', 'HERTZ',
      'HOSPITAL', 'CLINTEC', 'DIGICLINTEC', 'METROLOGIA'
    ]);

    if (ignoredWords.has(clean.toUpperCase())) return;

    const key = clean.toUpperCase();
    if (!candidatesMap.has(key) || candidatesMap.get(key).confidence < confidence) {
      candidatesMap.set(key, { token: clean, label, confidence });
    }
  };

  // 1. Linhas que contêm diretamente NS / Serial / IDEC
  const lines = rawText.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Procura por cada regex nos prefixos
    for (const regex of SERIAL_PREFIX_PATTERNS) {
      regex.lastIndex = 0;
      let match;
      while ((match = regex.exec(trimmed)) !== null) {
        if (match[1]) {
          const matchedText = match[0].toUpperCase();
          let label = 'Número Detectado';
          let confidence = 0.7;

          if (/N[\/\.]?S|SERIAL|S[EÉ]RIE|SN/i.test(matchedText)) {
            label = 'Número de Série (NS)';
            confidence = 0.95;
          } else if (/IDEC|TAG|IDENT/i.test(matchedText) || /^[A-Z]{2,6}-[0-9]{3,6}$/i.test(match[1])) {
            label = 'IDEC / Tag Hospitalar';
            confidence = 0.95;
          } else if (/^[0-9]{8,12}$/.test(match[1])) {
            label = 'Série Numérico (8-12 dígitos)';
            confidence = 0.85;
          }

          addCandidate(match[1], label, confidence);
        }
      }
    }
  }

  // 2. Fallback: procurar sequências de dígitos com 7 a 12 caracteres no texto completo
  const digitsMatches = rawText.match(/\b\d{7,12}\b/g) || [];
  for (const d of digitsMatches) {
    addCandidate(d, 'Série Numérico', 0.80);
  }

  // 3. Fallback: códigos no formato TAG (ex: CCHL-0075)
  const tagMatches = rawText.match(/\b[A-Za-z]{2,6}\s*-\s*\d{3,6}\b/g) || [];
  for (const t of tagMatches) {
    addCandidate(t.replace(/\s+/g, ''), 'IDEC / Tag Hospitalar', 0.90);
  }

  return Array.from(candidatesMap.values()).sort((a, b) => b.confidence - a.confidence);
}

/**
 * Agente Principal: Analisa o texto OCR e cruza com a lista de equipamentos cadastrados.
 * 
 * @param {string} rawText Texto obtido da digitalização/foto
 * @param {Array} equipments Lista de equipamentos da planilha ativa
 * @returns {{
 *   rawText: string,
 *   candidatesFound: Array,
 *   matchedEquipments: Array<{
 *     equipment: Object,
 *     matchedToken: string,
 *     tokenLabel: string,
 *     isExact: boolean,
 *     matchScore: number,
 *     reason: string,
 *     alreadyChecked: boolean
 *   }>,
 *   unmatchedTokens: Array
 * }}
 */
export function processPhotoTextWithAgent(rawText, equipments = []) {
  const candidates = extractSerialCandidates(rawText);
  
  const matchedEquipments = [];
  const seenEquipmentIds = new Set();
  const unmatchedTokens = [];

  for (const cand of candidates) {
    // Determina o modo de busca baseado no tipo detectado pelo agente
    let target = 'all';
    if (cand.label.includes('IDEC')) {
      target = 'idec';
    } else if (cand.label.includes('Série')) {
      target = 'serie';
    }

    // Busca o melhor equipamento usando nosso motor fuzzy
    let bestMatches = findBestEquipmentMatches(cand.token, equipments, target);
    
    // Se não encontrou no modo estrito, tenta no modo geral 'all'
    if ((!bestMatches || bestMatches.length === 0) && target !== 'all') {
      bestMatches = findBestEquipmentMatches(cand.token, equipments, 'all');
    }

    if (bestMatches && bestMatches.length > 0) {
      const match = bestMatches[0];
      const eqId = match.equipment.id;

      if (!seenEquipmentIds.has(eqId)) {
        seenEquipmentIds.add(eqId);
        matchedEquipments.push({
          equipment: match.equipment,
          matchedToken: cand.token,
          tokenLabel: cand.label,
          isExact: match.isExact,
          matchScore: match.score,
          matchingDigits: match.matchingDigits,
          reason: match.reason,
          alreadyChecked: Boolean(match.equipment.checado)
        });
      }
    } else {
      unmatchedTokens.push(cand);
    }
  }

  return {
    rawText,
    candidatesFound: candidates,
    matchedEquipments,
    unmatchedTokens,
    totalIdentified: matchedEquipments.length
  };
}
