import { 
  parseWorkbookBuffer, 
  isMaintenanceExternalText, 
  parseCheckValue,
  isPrevOnlyText,
  isTseOnlyText,
  isCalibradoText
} from './sheetParser.js';
import { findBestEquipmentMatches, cleanAlphanumeric } from './fuzzyMatch.js';

export { isPrevOnlyText, isTseOnlyText, isCalibradoText };

/**
 * Detecta se uma célula de status representa um item PENDENTE ou não calibrado
 */
export function isPendingText(val) {
  if (val === null || val === undefined) return false;
  const s = String(val)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
  if (!s) return false;
  return (
    s === 'pendente' ||
    s.includes('pendent') ||
    s === 'aguardando' ||
    s.includes('aguardando') ||
    s === 'a calibrar' ||
    s === 'a fazer' ||
    s === 'aberto' ||
    s === 'em aberto' ||
    s === 'nao' ||
    s === 'não' ||
    s === 'nao calibrado' ||
    s === 'não calibrado' ||
    s === '0' ||
    s === 'inativo' ||
    s === 'false'
  );
}

/**
 * Classifica com precisão se a linha do arquivo é Manutenção Externa, Calibração, Preventiva (Prev), TSE ou Pendente
 */
export function classifyImportedServiceType(item, fileHasCheckOrStatusCol = false) {
  if (!item) return 'pendente';

  // 1. Prioridade máxima: Manutenção / Manutenção Externa
  if (checkIfItemIsMaintenance(item)) {
    return 'externa';
  }

  const row = item._originalRow || item;

  // 2. Procura termos e gatilhos explícitos nas colunas da linha
  let hasExplicitPending = false;
  let hasExplicitPrev = false;
  let hasExplicitTse = false;
  let hasExplicitCal = false;
  let hasGenericCheck = false;

  for (const [k, v] of Object.entries(row)) {
    if (k.startsWith('_')) continue;
    if (isPendingText(v)) hasExplicitPending = true;
    if (isPrevOnlyText(v)) hasExplicitPrev = true;
    if (isTseOnlyText(v)) hasExplicitTse = true;
    if (isCalibradoText(v)) hasExplicitCal = true;
    if (parseCheckValue(v)) hasGenericCheck = true;
  }

  // Se o item já tem marcação direta de calibração ou modalidade no objeto
  if (item.check_calibracao || (item.checado && !item.check_externa)) {
    hasExplicitCal = true;
  }
  if (item.check_preventiva) hasExplicitPrev = true;
  if (item.check_seguranca) hasExplicitTse = true;

  // Gatilho: Somente Preventiva (Prev)
  if (hasExplicitPrev && !hasExplicitCal && !hasExplicitTse) {
    return 'preventiva';
  }

  // Gatilho: Somente Teste de Segurança (TSE)
  if (hasExplicitTse && !hasExplicitCal && !hasExplicitPrev) {
    return 'seguranca';
  }

  // Gatilho: Calibrado
  if (hasExplicitCal && !hasExplicitPending) {
    return 'calibrado';
  }

  // Se tiver indicação afirmativa genérica de calibração/check e não for pendente
  if (hasGenericCheck && !hasExplicitPending) {
    return 'calibracao_completa';
  }

  // Se estiver marcado explicitamente como pendente
  if (hasExplicitPending) {
    return 'pendente';
  }

  // Se o arquivo possui coluna de checagem/status e esta linha não teve check positivo
  if (fileHasCheckOrStatusCol) {
    return 'pendente';
  }

  // Fallback: se o arquivo não tem nenhuma coluna de conferência
  return 'calibrado';
}

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

        // Avalia se o arquivo possui coluna de checagem/status onde parte das linhas está conferida ou pendente
        let fileHasCheckOrStatusCol = false;
        for (const item of importedList) {
          const row = item._originalRow || item;
          for (const [k, v] of Object.entries(row)) {
            if (k.startsWith('_')) continue;
            if (parseCheckValue(v) || isPendingText(v)) {
              fileHasCheckOrStatusCol = true;
              break;
            }
          }
          if (fileHasCheckOrStatusCol) break;
        }

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

            // Classificação inteligente da linha importada (externa, calibracao_completa ou pendente)
            const classifiedService = classifyImportedServiceType(item, fileHasCheckOrStatusCol);
            const isFileExterna = classifiedService === 'externa';
            const isPendente = classifiedService === 'pendente';

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
              detectedServiceType: classifiedService,
              serviceType: classifiedService,
              fileDate: (isFileExterna ? item.data_externa : null) || item.dataCheck || item.data_calibracao || null,
              fileUser: (isFileExterna ? item.usuario_externa : null) || item.conferidoPor || item.usuario_calibracao || null,
              fileMotivo: item.motivo_externa || (isFileExterna ? 'Calibração e conserto por equipe externa terceirizada' : null),
              fileSector: item.setor_retirada || item.setor || null,
              // CRUCIAL: Bombas pendentes na planilha NUNCA vêm selecionadas por padrão!
              // Apenas bombas efetivamente calibradas ou em manutenção vêm marcadas.
              selected: !isPendente
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

    if (!match || !match.selected) {
      return eq;
    }

    // Se o serviço do item for pendente no arquivo e o modo for auto, NÃO altera o equipamento!
    const effectiveType = (targetMode === 'externa') 
      ? 'externa' 
      : (targetMode === 'calibracao_completa') 
        ? 'calibracao_completa' 
        : (match.serviceType || match.detectedServiceType || 'calibracao_completa');

    if (effectiveType === 'pendente') {
      return eq;
    }

    const copy = { ...eq };
    let hasChanges = false;

    const dateToApply = match.fileDate || nowIso;
    const userToApply = match.fileUser || inspector;

    // Determina se este item será carimbado como Manutenção Externa
    const isThisItemExterna = (effectiveType === 'externa');

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
        copy.check_preventiva = false;
        copy.check_seguranca = false;
        copy.checado = true;
        copy.dataCheck = dateToApply;
        copy.conferidoPor = userToApply;
        hasChanges = true;
      }
    } else if (effectiveType === 'preventiva') {
      // GATILHO 'Prev': Marca exclusivamente Preventiva
      if (overwriteExisting || !copy.check_preventiva) {
        copy.check_preventiva = true;
        copy.data_preventiva = dateToApply;
        copy.usuario_preventiva = userToApply;
        copy.check_externa = false;
        copy.data_externa = null;
        copy.usuario_externa = null;
        copy.motivo_externa = null;
        copy.checado = true;
        copy.dataCheck = dateToApply;
        copy.conferidoPor = userToApply;
        hasChanges = true;
      }
    } else if (effectiveType === 'seguranca') {
      // GATILHO 'tse': Marca exclusivamente Teste de Segurança Elétrica
      if (overwriteExisting || !copy.check_seguranca) {
        copy.check_seguranca = true;
        copy.data_seguranca = dateToApply;
        copy.usuario_seguranca = userToApply;
        copy.check_externa = false;
        copy.data_externa = null;
        copy.usuario_externa = null;
        copy.motivo_externa = null;
        copy.checado = true;
        copy.dataCheck = dateToApply;
        copy.conferidoPor = userToApply;
        hasChanges = true;
      }
    } else {
      // GATILHO 'calibrado' ou 'calibracao_completa'
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
