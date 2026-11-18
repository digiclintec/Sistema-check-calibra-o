/**
 * Utilitário Especializado de Detecção, Limpeza e Padronização de IDEC e Códigos Hospitalares
 * 
 * Suporta:
 * 1. Padrão IDEC Hospitalar: [Setor][Hospital]-[Número] (ex: SVPHL-0010, UTIAHL-0119, UTIPHL-0099, ATHL-0021, etc.)
 *    HL = Hospital Luiz Buaiz, HA = Hospital Aquidaban, HM = Hospital Maternidade/Sumaré, HG = Hospital Guarapari
 * 2. Correção automática de erros de OCR em caracteres semelhantes (O -> 0, I/l/1 -> L em siglas ou 1 em dígitos, S -> 5, etc.)
 * 3. Padronização de leituras de códigos de barras de bombas de infusão (extração do número de série real descartando modelo e sufixos)
 * 4. Decomposição de códigos GS1 com Application Identifier (AI 21)
 * 5. Captura direta do fluxo de vídeo e OCR de etiquetas físicas (quando o aparelho não possui código de barras)
 */

// Padrões RegEx de IDEC e Tags Hospitalares
const IDEC_HOSPITAL_REGEX = /\b([A-Z]{2,6}(?:HL|HA|HM|HG|HLB|HI|H1|Hl|H4)[-_ ]?[0-9OIl]{2,6})\b/gi;
const IDEC_GENERIC_TAG_REGEX = /\b([A-Z]{2,6}[-_][0-9OIl]{2,6})\b/gi;
const IDEC_BI_REGEX = /\b(BI[-_ ]?[0-9OIl]{1,5})\b/gi;
const IDEC_LABELED_REGEX = /\b(?:[iIlL1]?dentifica[cç][aã]o|idec|tag|patr[ií]m[oô]nio|patrimonio|pat|tombamento|tomb|ns|s[eé]rie|aparelho)\b[:\s-]*([A-Z0-9\-_ ]{3,25})/gi;
const ARKMEDS_ID_REGEX = /\bID[:\s]+(\d{3,7})\b/gi;

const COMMON_IGNORE_WORDS = new Set([
  'DIGITAL', 'EQUIPAMENTO', 'HOSPITAL', 'CLINICA', 'GERAL', 'ADULTO', 'PEDIATRICA',
  'MODELO', 'FABRICANTE', 'SERIE', 'NUMERO', 'ARKMEDS', 'PATRIMONIO', 'IDENTIFICACAO',
  'VALIDADE', 'CALIBRACAO', 'STATUS', 'CONFORME', 'LUIZ', 'BUAIZ', 'AQUIDABAN',
  'TIPO', 'PROPRIETARIO', 'SISTEMA', 'MANUTENCAO', 'PREVENTIVA', 'TERCEIRIZADA'
]);

/**
 * Corrige confusões comuns de OCR em dígitos de números de série e IDEC
 * Ex: Letra 'O' em vez de número '0', letra 'l'/'I' em vez de '1'
 */
export function fixOcrDigits(digitsStr) {
  if (!digitsStr) return '';
  return String(digitsStr)
    .replace(/[O|o]/g, '0')
    .replace(/[I|l|i]/g, '1')
    .replace(/[S|s]/g, '5')
    .replace(/[B]/g, '8');
}

/**
 * Normaliza um IDEC para o formato padrão canônico com hífen
 * Ex: "svphl 0010" -> "SVPHL-0010"
 * Ex: "UTIAHI 0119" -> "UTIAHL-0119" (corrige 'HI' para 'HL')
 * Ex: "SVPH4-0010" -> "SVPHA-0010" (corrige 'H4' para 'HA')
 */
export function normalizeIdec(rawIdec) {
  if (!rawIdec) return '';
  let str = String(rawIdec).trim().toUpperCase();

  // Remove rótulos iniciais
  str = str.replace(/^(?:[iIlL1]?IDENTIFICA[CÇ][AÃ]O|IDEC|TAG|PATR[IÍ]M[OÔ]NIO|APARELHO|ID)[\s:\-_]+/i, '').trim();

  // Divide letras e números
  const match = str.match(/^([A-Z]+)[-_ ]*(.*)$/);
  if (match) {
    let letters = match[1];
    // Corrige sufixos hospitalares comuns distorcidos por OCR
    letters = letters.replace(/H[I1L]$/i, 'HL').replace(/H4$/i, 'HA');
    const rawNumberPart = match[2];
    const cleanNumber = fixOcrDigits(rawNumberPart).replace(/\D/g, '');
    if (cleanNumber) {
      return `${letters}-${cleanNumber}`;
    }
    return letters;
  }

  return str.replace(/\s+/g, '-');
}

/**
 * Avalia se uma palavra/string tem formato plausível de IDEC ou número de série
 */
export function isLikelyIdecOrSerial(val) {
  if (!val || typeof val !== 'string') return false;
  const clean = val.toUpperCase().trim();
  if (clean.length < 3) return false;
  if (COMMON_IGNORE_WORDS.has(clean)) return false;

  // Se tiver formato específico de IDEC hospitalar
  if (/[A-Z]{2,6}(?:HL|HA|HM|HG|HLB|HI|H1|Hl)[-_]?\d{2,6}/i.test(clean)) return true;

  // Se tiver letras e números combinados
  if (/\d/.test(clean) && /[A-Z]/.test(clean)) return true;

  // Se for puramente numérico com 3 ou mais dígitos (típico de tag numérica ou ID Arkmeds)
  if (/^\d{3,8}$/.test(clean)) return true;

  return false;
}

/**
 * Pré-processa o texto bruto reconhecido pelo OCR para corrigir artefatos clássicos de etiquetas
 */
export function preprocessOcrText(rawText) {
  if (!rawText) return '';
  let str = String(rawText);

  // Normaliza quebras de linha e espaçamentos duplos
  str = str.replace(/[\r\n]+/g, '\n').replace(/[ \t]+/g, ' ');

  // Corrige 'lentificação', 'entificação', 'Idenficacao'
  str = str.replace(/\b(?:l|i|1|L)?(?:dentifica[cç][aã]o|dentificacao)\b/gi, 'identificacao');

  // Corrige confusões de hospital no fim de siglas de setores (ex: UTIAHI -> UTIAHL, SVPHI -> SVPHL)
  str = str.replace(/\b([A-Z]{2,6})H[I|l|1]\b/gi, '$1HL');
  str = str.replace(/\b([A-Z]{2,6})H4\b/gi, '$1HA');

  return str;
}

/**
 * Extrai todos os candidatos a IDEC a partir de um texto lido via OCR da câmera
 */
export function extractIdecCandidates(ocrText) {
  if (!ocrText) return [];
  const text = preprocessOcrText(ocrText).toUpperCase();
  const candidates = new Set();

  // 1. Procura por rótulos explícitos (ex: "Identificação: UTIAHL-0119" ou "IDEC: SVPHL-0010")
  const labeledMatches = [...text.matchAll(IDEC_LABELED_REGEX)];
  for (const m of labeledMatches) {
    const val = m[1].trim();
    if (isLikelyIdecOrSerial(val)) {
      candidates.add(normalizeIdec(val));
    }
  }

  // 2. Procura pelo padrão hospitalar específico (SVPHL-0010, UTIAHL-0119, etc.)
  const hospMatches = [...text.matchAll(IDEC_HOSPITAL_REGEX)];
  for (const m of hospMatches) {
    candidates.add(normalizeIdec(m[1]));
  }

  // 3. Procura por ID direto do Arkmeds (ex: "ID: 3538")
  const idMatches = [...text.matchAll(ARKMEDS_ID_REGEX)];
  for (const m of idMatches) {
    const idVal = m[1].trim();
    if (idVal && idVal.length >= 3) {
      candidates.add(idVal);
    }
  }

  // 4. Procura por tags genéricas com hífen (ex: CC-0075, FAR-0010)
  const genMatches = [...text.matchAll(IDEC_GENERIC_TAG_REGEX)];
  for (const m of genMatches) {
    const norm = normalizeIdec(m[1]);
    if (isLikelyIdecOrSerial(norm)) {
      candidates.add(norm);
    }
  }

  // 5. Procura por Bombas de Infusão (BI-01, BI-0010)
  const biMatches = [...text.matchAll(IDEC_BI_REGEX)];
  for (const m of biMatches) {
    candidates.add(normalizeIdec(m[1]));
  }

  // 6. Procura por números de série com padrão médico comum (ex: CN23950450, FAL39106, 022551803)
  const serialMatches = text.match(/\b([A-Z]{1,4}\d{6,12}|\d{6,14})\b/g) || [];
  for (const s of serialMatches) {
    if (isLikelyIdecOrSerial(s)) {
      candidates.add(s);
    }
  }

  return Array.from(candidates).filter(Boolean);
}

/**
 * Padroniza a leitura de códigos de barras (Bombas de Infusão, Monitores, etc.)
 * Isola o número de série ou IDEC real descartando modelos, prefixos e sufixos
 */
export function standardizeBarcodeReading(rawCode, equipments = []) {
  if (!rawCode) return '';
  const text = String(rawCode).trim();

  // Se já for um IDEC no formato canônico
  if (/^[A-Z]{2,6}(?:HL|HA|HM|HG|HLB)[-_]\d{2,6}$/i.test(text)) {
    return text.toUpperCase();
  }

  // Se for uma URL de QR Code do Arkmeds (ex: https://hifaclinica.arkmeds.com/qr_code/equipamento/001005)
  if (text.includes('/qr_code/') || text.includes('arkmeds.com')) {
    return text;
  }

  // 1. Limpeza de prefixos de leitores ou etiquetas
  let clean = text.replace(/^(?:SN|S\/N|NS|N\/S|SER|SERIE|SÉRIE|SERIAL|TAG|IDEC|REF|PAT|PATRIMONIO|PATRIMÔNIO|TOMB|TOMBAMENTO)[:\s\-_]+/i, '').trim();

  // 2. Análise de código GS1 composto (01)GTIN(21)SERIAL
  const gs1Ai21 = text.match(/\(21\)([^()]+)/);
  if (gs1Ai21 && gs1Ai21[1]) {
    return gs1Ai21[1].trim();
  }

  // 3. Tratamento para Códigos compostos (Modelo + Separador + Número de Série ou Patrimônio)
  // Ex: "ST550T2-2104010003" ou "LF2001*2104010003" ou "PAT-012345" ou "BI-12345/01"
  if (clean.includes('-') || clean.includes('*') || clean.includes('/') || clean.includes('_')) {
    const parts = clean.split(/[-*\/_]/).map(p => p.trim()).filter(Boolean);
    
    // Se alguma parte bater com uma série, tag ou patrimônio cadastrado no plano atual
    if (equipments && equipments.length > 0) {
      for (const p of parts) {
        const found = equipments.find(e => 
          (e.serie && e.serie.toUpperCase() === p.toUpperCase()) ||
          (e.tag && e.tag.toUpperCase() === p.toUpperCase()) ||
          (e.patrimonio && e.patrimonio.toUpperCase() === p.toUpperCase()) ||
          (e.codigoBarras && e.codigoBarras.toUpperCase() === p.toUpperCase())
        );
        if (found) return p;
      }
    }

    // Geralmente a parte puramente numérica mais longa é o número de série da bomba
    const numericParts = parts.filter(p => /^\d{4,}$/.test(p));
    if (numericParts.length === 1) {
      return numericParts[0];
    }
  }

  return clean;
}

/**
 * Captura um quadro de alta nitidez do elemento <video> ativo da câmera,
 * recorta a região de mira central e aplica filtro de alto contraste para leitura de etiquetas.
 */
export function captureHighContrastLabelCanvas(videoEl, options = {}) {
  if (!videoEl || !videoEl.videoWidth || !videoEl.videoHeight) {
    throw new Error('Vídeo da câmera não está pronto para captura.');
  }

  const vw = videoEl.videoWidth;
  const vh = videoEl.videoHeight;

  // Recorta o quadrante central da mira onde a etiqueta está posicionada (72% largura x 55% altura)
  const cropW = Math.round(vw * (options.cropWidthRatio || 0.72));
  const cropH = Math.round(vh * (options.cropHeightRatio || 0.55));
  const cropX = Math.round((vw - cropW) / 2);
  const cropY = Math.round((vh - cropH) / 2);

  const canvas = document.createElement('canvas');
  canvas.width = cropW;
  canvas.height = cropH;
  const ctx = canvas.getContext('2d');

  // Desenha o recorte da imagem original
  ctx.drawImage(videoEl, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

  // Filtro de Alto Contraste em Escala de Cinza para OCR de texto nítido
  try {
    const imgData = ctx.getImageData(0, 0, cropW, cropH);
    const d = imgData.data;
    const factor = 1.6; // Aumento de contraste de 60%
    for (let i = 0; i < d.length; i += 4) {
      const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      const contrast = (gray - 128) * factor + 128;
      const finalVal = contrast < 0 ? 0 : contrast > 255 ? 255 : contrast;
      d[i] = finalVal;
      d[i + 1] = finalVal;
      d[i + 2] = finalVal;
    }
    ctx.putImageData(imgData, 0, 0);
  } catch (err) {
    console.warn('[idecParser] Filtro de contraste ignorado:', err);
  }

  return {
    canvas,
    dataUrl: canvas.toDataURL('image/jpeg', 0.92),
    width: cropW,
    height: cropH
  };
}

/**
 * Lê e decodifica o IDEC de uma etiqueta física diretamente do fluxo da câmera
 */
export async function scanIdecFromVideo(videoEl, onProgress = null) {
  const { dataUrl } = captureHighContrastLabelCanvas(videoEl);

  let rawText = '';

  // 1. Tenta OCR local via Tesseract.js no navegador
  try {
    if (onProgress) onProgress('Processando caracteres da etiqueta...');
    const { createWorker } = await import('tesseract.js');
    const worker = await createWorker('por+eng', 1, {
      logger: (m) => {
        if (m.status === 'recognizing text' && m.progress && onProgress) {
          onProgress(`Lendo IDEC (${Math.round(m.progress * 100)}%)...`);
        }
      }
    });

    const ret = await worker.recognize(dataUrl);
    rawText = ret.data.text || '';
    await worker.terminate();
  } catch (clientErr) {
    console.warn('[idecParser] Fallback para OCR no servidor:', clientErr);
    if (onProgress) onProgress('Consultando reconhecimento no servidor...');
    const res = await fetch('/api/ocr-scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64: dataUrl })
    });
    const data = await res.json();
    if (data.success) {
      rawText = data.text || '';
    } else {
      throw new Error(data.message || 'Falha ao processar OCR da etiqueta.');
    }
  }

  const candidates = extractIdecCandidates(rawText);
  return {
    success: candidates.length > 0,
    candidates,
    bestCandidate: candidates[0] || null,
    rawText
  };
}
