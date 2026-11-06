import { parseWorkbookBuffer, isMaintenanceExternalText } from './sheetParser.js';
import { findBestEquipmentMatches, cleanAlphanumeric } from './fuzzyMatch.js';

/**
 * Avalia se um item ou linha importada corresponde à Manutenção / Manutenção Externa
 */
export function checkIfItemIsMaintenance(item) {
  if (!item) return false;
  if (item.check_externa) return true;

  // 1. Campos diretos mapeados no item
  const fieldsToCheck = [
    item.status,
    item.statusCalibracao,
    item.situacao,
    item.tipo,
    item.servico,
    item.observacao,
    item.destino,
    item.motivo_externa,
    item.setor,
    item.setor_retirada
  ];

  for (const val of fieldsToCheck) {
    if (isMaintenanceExternalText(val)) return true;
  }

  // 2. Colunas e valores da linha original do arquivo
  if (item._originalRow && typeof item._originalRow === 'object') {
    for (const [key, val] of Object.entries(item._originalRow)) {
      const cleanKey = String(key)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();

      // Se a coluna é sobre manutenção (ex: "MANUTENÇÃO", "EM MANUTENÇÃO", "MANUT", "CONSERTO", etc.)
      if (
        !cleanKey.includes('preventiv') &&
        (
          cleanKey.includes('manut') || 
          cleanKey.includes('conserto') || 
          cleanKey.includes('reparo') || 
          cleanKey.includes('extern') || 
          cleanKey.includes('terceir') ||
          cleanKey.includes('assistenc')
        )
      ) {
        const sVal = String(val ?? '').trim().toLowerCase();
        if (sVal && sVal !== 'nao' && sVal !== 'não' && sVal !== 'false' && sVal !== '0') {
          return true;
        }
      }

      // Se o valor de QUALQUER célula desta linha contém "manutenção", "em manutenção", etc.
      if (isMaintenanceExternalText(val)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Lê arquivo (XLSX, XLS, CSV ou PDF) e identifica bombas e calibrações correspondentes
 * para mesclar com o plano ativo sem duplicar ou apagar nada.
 * Suporta detecção de Calibração Completa E Manutenção Externa.
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
 * Processa arquivo Excel / CSV para mesclagem de calibrações e manutenção externa
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

            // Detecção robusta se este item da planilha importada é Manutenção / Manutenção Externa
            const isFileExterna = checkIfItemIsMaintenance(item);

            const isAlreadyExterna = Boolean(bestMatch.equipment.check_externa);
            const isAlreadyCalibrated = Boolean(
              bestMatch.equipment.check_calibracao || 
              bestMatch.equipment.check_preventiva || 
              bestMatch.equipment.check_seguranca
            );

            matches.push({
              targetEquipment: bestMatch.equipment,
              importedItem: item,
              matchReason: bestMatch.reason,
              confidence: bestMatch.confidence,
              isAlreadyChecked: Boolean(isAlreadyCalibrated || isAlreadyExterna || bestMatch.equipment.checado),
              isAlreadyExterna,
              isAlreadyCalibrated,
              detectedServiceType: isFileExterna ? 'externa' : 'calibracao_completa',
              serviceType: isFileExterna ? 'externa' : 'calibracao_completa',
              fileDate: (isFileExterna ? item.data_externa : null) || item.dataCheck || item.data_calibracao || null,
              fileUser: (isFileExterna ? item.usuario_externa : null) || item.conferidoPor || item.usuario_calibracao || null,
              fileMotivo: item.motivo_externa || (isFileExterna ? 'Calibração e conserto por equipe externa terceirizada' : null),
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

            // Verifica se o contexto deste PDF ou linhas próximas indicam Manutenção / Manutenção Externa
            const targetToken = (serial || tag || barcode || '').toLowerCase();
            const nearbyLines = lines.filter(l => l.toLowerCase().includes(targetToken));
            const nearbyText = nearbyLines.join(' ');
            const isItemExterna = isMaintenanceExternalText(nearbyText) || isMaintenanceExternalText(fullText);

            const isAlreadyExterna = Boolean(eq.check_externa);
            const isAlreadyCalibrated = Boolean(eq.check_calibracao || eq.check_preventiva || eq.check_seguranca);

            matches.push({
              targetEquipment: eq,
              importedItem: {
                serie: eq.serie,
                tag: eq.tag,
                equipamento: eq.equipamento
              },
              matchReason: matchDetail,
              confidence: 95,
              isAlreadyChecked: Boolean(isAlreadyCalibrated || isAlreadyExterna || eq.checado),
              isAlreadyExterna,
              isAlreadyCalibrated,
              detectedServiceType: isItemExterna ? 'externa' : 'calibracao_completa',
              serviceType: isItemExterna ? 'externa' : 'calibracao_completa',
              fileDate: null,
              fileUser: null,
              fileMotivo: isItemExterna ? 'Calibração e conserto por equipe externa terceirizada' : null,
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
 * Mescla as calibrações e manutenções externas no array de equipamentos ativo
 */
export function mergeCalibrationsIntoEquipments(
  currentEquipments = [], 
  selectedMatches = [], 
  options = {}
) {
  const {
    modalities = ['calibracao', 'preventiva', 'seguranca'],
    targetMode = 'auto', // 'auto' | 'calibracao_completa' | 'externa'
    inspector = 'Importação / Mesclagem',
    customDate = null,
    overwriteExisting = false,
    motivoExterna = 'Calibração e conserto por equipe externa terceirizada'
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

    // Determina se este item será carimbado como Manutenção Externa
    const isThisItemExterna = (targetMode === 'externa') || 
      (targetMode === 'auto' && (match.serviceType === 'externa' || match.detectedServiceType === 'externa'));

    if (isThisItemExterna) {
      if (overwriteExisting || !copy.check_externa) {
        copy.check_externa = true;
        copy.data_externa = dateToApply;
        copy.usuario_externa = userToApply;
        copy.motivo_externa = match.fileMotivo || motivoExterna;
        // Ao registrar manutenção externa, limpa calibração interna conforme regra do sistema
        copy.check_calibracao = false;
        copy.data_calibracao = null;
        copy.usuario_calibracao = null;
        copy.checado = true;
        copy.dataCheck = dateToApply;
        copy.conferidoPor = userToApply;
        hasChanges = true;
      }
    } else {
      // Aplica Calibração Completa / Serviços internos
      modalities.forEach(m => {
        if (m === 'calibracao') {
          if (overwriteExisting || !copy.check_calibracao) {
            copy.check_calibracao = true;
            copy.data_calibracao = dateToApply;
            copy.usuario_calibracao = userToApply;
            copy.check_externa = false;
            copy.data_externa = null;
            copy.usuario_externa = null;
            copy.motivo_externa = null;
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
        }
      });
      if (hasChanges) {
        copy.check_externa = false;
        copy.checado = Boolean(copy.check_calibracao || copy.check_preventiva || copy.check_seguranca);
        copy.dataCheck = copy.data_calibracao || copy.data_preventiva || copy.data_seguranca || dateToApply;
        copy.conferidoPor = copy.usuario_calibracao || userToApply;
      }
    }

    if (match.fileSector && !copy.setor_retirada) {
      copy.setor_retirada = match.fileSector;
    }

    if (hasChanges) {
      updatedCount++;
    }

    return copy;
  });

  return {
    updatedEquipments,
    updatedCount
  };
}
