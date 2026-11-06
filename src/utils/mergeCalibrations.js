import { parseWorkbookBuffer } from './sheetParser';
import { findBestEquipmentMatches, cleanAlphanumeric } from './fuzzyMatch';

/**
 * Lê arquivo (XLSX, XLS, CSV ou PDF) e identifica bombas e calibrações correspondentes
 * para mesclar com o plano ativo sem duplicar ou apagar nada.
 */
export async function parseFileForCalibrationMerge(file, currentEquipments = []) {
  const fileName = file.name || 'arquivo';
  const isPdf = fileName.toLowerCase().endsWith('.pdf');

  if (isPdf) {
    return parsePdfFileForMerge(file, currentEquipments);
  } else {
    return parseExcelFileForMerge(file, currentEquipments);
  }
}

/**
 * Processa arquivo Excel / CSV para mesclagem de calibrações
 */
async function parseExcelFileForMerge(file, currentEquipments = []) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const parsed = parseWorkbookBuffer(data, file.name);
        const importedList = parsed.equipments || [];

        const matches = [];
        const unmatched = [];
        const matchedEqIds = new Set();

        importedList.forEach(item => {
          // Identificadores possíveis
          const candidates = [
            item.serie,
            item.tag,
            item.codigoBarras,
            item.id
          ].filter(Boolean);

          let bestMatch = null;

          for (const cand of candidates) {
            const results = findBestEquipmentMatches(String(cand).trim(), currentEquipments);
            if (results && results.length > 0 && results[0].confidence >= 75) {
              bestMatch = results[0];
              break;
            }
          }

          if (bestMatch && !matchedEqIds.has(bestMatch.equipment.id)) {
            matchedEqIds.add(bestMatch.equipment.id);
            matches.push({
              targetEquipment: bestMatch.equipment,
              importedItem: item,
              matchReason: bestMatch.reason,
              confidence: bestMatch.confidence,
              isAlreadyChecked: Boolean(
                bestMatch.equipment.check_calibracao || 
                bestMatch.equipment.check_preventiva || 
                bestMatch.equipment.checado
              ),
              fileDate: item.dataCheck || item.data_calibracao || null,
              fileUser: item.conferidoPor || item.usuario_calibracao || null,
              fileSector: item.setor_retirada || item.setor || null,
              selected: true // Marcado por padrão para mesclar
            });
          } else if (!bestMatch) {
            unmatched.push(item);
          }
        });

        resolve({
          success: true,
          fileName: file.name,
          fileType: 'excel',
          totalInFile: importedList.length,
          matches,
          unmatched,
          totalMatches: matches.length
        });
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Processa arquivo PDF extraindo texto das tabelas/laudos e cruzando com o plano ativo
 */
async function parsePdfFileForMerge(file, currentEquipments = []) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const base64 = e.target.result;
        const res = await fetch('/api/parse-pdf-calibrations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pdfBase64: base64 })
        });

        if (!res.ok) {
          throw new Error('Falha no servidor ao processar o PDF.');
        }

        const data = await res.json();
        if (!data.success) {
          throw new Error(data.message || 'Erro ao extrair texto do PDF.');
        }

        const fullText = data.text || '';
        const lines = data.lines || [];
        const matches = [];
        const matchedEqIds = new Set();

        // Para cada equipamento do plano, procura se a série ou a tag aparecem no texto do PDF
        currentEquipments.forEach(eq => {
          const serial = eq.serie ? String(eq.serie).trim() : null;
          const tag = eq.tag ? String(eq.tag).trim() : null;
          const barcode = eq.codigoBarras ? String(eq.codigoBarras).trim() : null;

          let found = false;
          let matchDetail = '';

          // Busca por número de série isolado
          if (serial && serial.length >= 4) {
            const cleanS = cleanAlphanumeric(serial);
            // Regex com bordas de palavra para não dar falso positivo
            const regex = new RegExp(`(^|[^a-zA-Z0-9])${serial}([^a-zA-Z0-9]|$)`, 'i');
            if (regex.test(fullText)) {
              found = true;
              matchDetail = `Série "${serial}" identificada no PDF`;
            }
          }

          // Busca por Tag / IDEC
          if (!found && tag && tag.length >= 3) {
            const regex = new RegExp(`(^|[^a-zA-Z0-9])${tag}([^a-zA-Z0-9]|$)`, 'i');
            if (regex.test(fullText)) {
              found = true;
              matchDetail = `IDEC/Tag "${tag}" identificado no PDF`;
            }
          }

          // Busca por Código de barras
          if (!found && barcode && barcode.length >= 5) {
            const regex = new RegExp(`(^|[^a-zA-Z0-9])${barcode}([^a-zA-Z0-9]|$)`, 'i');
            if (regex.test(fullText)) {
              found = true;
              matchDetail = `Código "${barcode}" identificado no PDF`;
            }
          }

          if (found && !matchedEqIds.has(eq.id)) {
            matchedEqIds.add(eq.id);
            matches.push({
              targetEquipment: eq,
              importedItem: {
                serie: eq.serie,
                tag: eq.tag,
                equipamento: eq.equipamento
              },
              matchReason: matchDetail,
              confidence: 95,
              isAlreadyChecked: Boolean(eq.check_calibracao || eq.check_preventiva || eq.checado),
              fileDate: null,
              fileUser: null,
              fileSector: null,
              selected: true
            });
          }
        });

        resolve({
          success: true,
          fileName: file.name,
          fileType: 'pdf',
          totalInFile: lines.length,
          matches,
          unmatched: [],
          totalMatches: matches.length
        });
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

/**
 * Mescla as calibrações no array de equipamentos ativo
 */
export function mergeCalibrationsIntoEquipments(
  currentEquipments = [], 
  selectedMatches = [], 
  options = {}
) {
  const {
    modalities = ['calibracao', 'preventiva', 'seguranca'],
    inspector = 'Importação / Mesclagem',
    customDate = null,
    overwriteExisting = false
  } = options;

  const matchMap = new Map();
  selectedMatches.forEach(m => {
    if (m.selected && m.targetEquipment) {
      matchMap.set(String(m.targetEquipment.id).toLowerCase(), m);
    }
  });

  const nowIso = customDate || new Date().toISOString();
  let updatedCount = 0;

  const updatedEquipments = currentEquipments.map(eq => {
    const k = String(eq.id).toLowerCase();
    const match = matchMap.get(k);

    if (!match) {
      return eq;
    }

    const copy = { ...eq };
    let hasChanges = false;

    const dateToApply = match.fileDate || nowIso;
    const userToApply = match.fileUser || inspector;

    modalities.forEach(m => {
      if (m === 'calibracao') {
        if (overwriteExisting || !copy.check_calibracao) {
          copy.check_calibracao = true;
          copy.data_calibracao = dateToApply;
          copy.usuario_calibracao = userToApply;
          copy.check_externa = false;
          hasChanges = true;
        }
      } else if (m === 'preventiva') {
        if (overwriteExisting || !copy.check_preventiva) {
          copy.check_preventiva = true;
          copy.data_preventiva = dateToApply;
          copy.usuario_preventiva = userToApply;
          hasChanges = true;
        }
      } else if (m === 'seguranca') {
        if (overwriteExisting || !copy.check_seguranca) {
          copy.check_seguranca = true;
          copy.data_seguranca = dateToApply;
          copy.usuario_seguranca = userToApply;
          hasChanges = true;
        }
      } else if (m === 'externa') {
        copy.check_externa = true;
        copy.data_externa = dateToApply;
        copy.usuario_externa = userToApply;
        copy.check_calibracao = false;
        hasChanges = true;
      }
    });

    if (match.fileSector && !copy.setor_retirada) {
      copy.setor_retirada = match.fileSector;
    }

    if (hasChanges) {
      copy.checado = Boolean(copy.check_calibracao || copy.check_preventiva || copy.check_seguranca || copy.check_externa);
      copy.dataCheck = copy.data_calibracao || copy.data_preventiva || copy.data_seguranca || dateToApply;
      copy.conferidoPor = copy.usuario_calibracao || userToApply;
      updatedCount++;
    }

    return copy;
  });

  return {
    updatedEquipments,
    updatedCount
  };
}
