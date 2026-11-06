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
 * Classifica com precisão se a linha do arquivo é Manutenção Externa, Calibração, Preventiva (Prev), TSE, Parcial ou Pendente
 */
export function classifyImportedServiceType(item, fileHasCheckOrStatusCol = false) {
  if (!item) return 'pendente';

  // 1. Manutenção Externa (Prioridade máxima caso esteja marcada como externa)
  if (checkIfItemIsMaintenance(item)) {
    return 'externa';
  }

  // 2. Frentes já extraídas pelo parser de planilhas
  const hasCal = Boolean(item.check_calibracao);
  const hasPrev = Boolean(item.check_preventiva);
  const hasSeg = Boolean(item.check_seguranca);

  // 100% Concluído nas 3 frentes
  if (hasCal && hasPrev && hasSeg) {
    return 'completa';
  }

  // Apenas calibração
  if (hasCal && !hasPrev && !hasSeg) {
    return 'calibrado';
  }

  // Apenas preventiva
  if (hasPrev && !hasCal && !hasSeg) {
    return 'preventiva';
  }

  // Apenas segurança elétrica
  if (hasSeg && !hasCal && !hasPrev) {
    return 'seguranca';
  }

  // Combinação parcial (ex: Calibração + Preventiva)
  if (hasCal || hasPrev || hasSeg) {
    return 'parcial';
  }

  // Movimentado de setor (recolhido em setor diferente) mesmo sem serviços ainda
  if (item.setor_retirada && item.setor && item.setor_retirada.trim().toLowerCase() !== item.setor.trim().toLowerCase()) {
    return 'movimentado';
  }

  // 3. Fallback para colunas brutas de planilhas genéricas que não possuíam colunas estruturadas
  const row = item._originalRow || item;
  let hasGenericCheck = false;
  let hasExplicitPending = false;

  for (const [k, v] of Object.entries(row)) {
    if (k.startsWith('_')) continue;
    const cleanK = String(k).toLowerCase();
    // Só analisa células de colunas que tenham semântica de conferência/status
    if (cleanK.includes('status') || cleanK.includes('check') || cleanK.includes('confer') || cleanK.includes('situacao') || cleanK.includes('estado')) {
      if (isPendingText(v)) hasExplicitPending = true;
      if (parseCheckValue(v) || isCalibradoText(v)) hasGenericCheck = true;
    }
  }

  if (hasGenericCheck && !hasExplicitPending) {
    return 'calibrado';
  }

  return 'pendente';
}

/**
 * Avalia se um item ou linha importada corresponde à Manutenção / Manutenção Externa
 */
export function checkIfItemIsMaintenance(item) {
  if (!item) return false;
  // Se já foi classificado pelo parser
  if (item.check_externa === true) return true;
  if (item.check_externa === false && (item.check_calibracao || item.check_preventiva || item.check_seguranca)) {
    return false;
  }

  // 1. Campos diretos de serviço/status
  const statusFields = [
    item.status,
    item.situacao,
    item.tipo,
    item.servico,
    item.destino,
    item.motivo_externa
  ];

  for (const val of statusFields) {
    if (isMaintenanceExternalText(val)) return true;
  }

  // 2. Coluna específica de manutenção na linha original (evita falso positivo em colunas de setor ou observação)
  if (item._originalRow && typeof item._originalRow === 'object') {
    for (const [key, val] of Object.entries(item._originalRow)) {
      const cleanKey = String(key)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();

      // Ignora setor e observação livre para não confundir nomes de locais
      if (cleanKey.includes('setor') || cleanKey.includes('local') || cleanKey.includes('preventiv') || cleanKey.includes('obs')) {
        continue;
      }

      if (
        cleanKey.includes('extern') || 
        cleanKey.includes('terceir') ||
        cleanKey.includes('conserto') || 
        cleanKey.includes('reparo') || 
        cleanKey.includes('assistenc') ||
        (cleanKey.includes('manut') && (cleanKey.includes('status') || cleanKey.includes('check') || cleanKey.includes('situacao') || cleanKey.includes('tipo')))
      ) {
        if (isMaintenanceExternalText(val) || parseCheckValue(val)) {
          return true;
        }
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

              // Detalhamento individual das frentes do arquivo importado
              fileCalibracao: Boolean(item.check_calibracao),
              fileDataCalibracao: item.data_calibracao || null,
              fileUsuarioCalibracao: item.usuario_calibracao || null,

              filePreventiva: Boolean(item.check_preventiva),
              fileDataPreventiva: item.data_preventiva || null,
              fileUsuarioPreventiva: item.usuario_preventiva || null,

              fileSeguranca: Boolean(item.check_seguranca),
              fileDataSeguranca: item.data_seguranca || null,
              fileUsuarioSeguranca: item.usuario_seguranca || null,

              fileExterna: Boolean(isFileExterna || item.check_externa),
              fileDataExterna: item.data_externa || null,
              fileUsuarioExterna: item.usuario_externa || null,
              fileMotivoExterna: item.motivo_externa || (isFileExterna ? 'Calibração e conserto por equipe externa terceirizada' : null),

              fileSetorRetirada: item.setor_retirada || null,
              fileDataRetirada: item.data_retirada || null,
              fileUsuarioRetirada: item.usuario_retirada || null,

              fileDate: (isFileExterna ? item.data_externa : null) || item.data_calibracao || item.data_preventiva || item.data_seguranca || item.dataCheck || null,
              fileUser: (isFileExterna ? item.usuario_externa : null) || item.usuario_calibracao || item.usuario_preventiva || item.usuario_seguranca || item.conferidoPor || null,
              fileMotivo: item.motivo_externa || (isFileExterna ? 'Calibração e conserto por equipe externa terceirizada' : null),
              fileSector: item.setor_retirada || item.setor || null,

              // Bombas pendentes no arquivo vêm desmarcadas; bombas com QUALQUER serviço ou movimentação vêm selecionadas por padrão!
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
              detectedServiceType: isItemExterna ? 'externa' : 'completa',
              serviceType: isItemExterna ? 'externa' : 'completa',
              fileCalibracao: !isItemExterna,
              filePreventiva: !isItemExterna,
              fileSeguranca: !isItemExterna,
              fileExterna: isItemExterna,
              fileDataCalibracao: null,
              fileUsuarioCalibracao: null,
              fileDataPreventiva: null,
              fileUsuarioPreventiva: null,
              fileDataSeguranca: null,
              fileUsuarioSeguranca: null,
              fileDataExterna: null,
              fileUsuarioExterna: null,
              fileSetorRetirada: null,
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
    const item = match.importedItem || {};
    let hasChanges = false;

    const dateToApply = match.fileDate || nowIso;
    const userToApply = match.fileUser || inspector;

    // Determina se este item será carimbado como Manutenção Externa
    const isThisItemExterna = (targetMode === 'externa') || (targetMode === 'auto' && Boolean(match.fileExterna || item.check_externa || effectiveType === 'externa'));

    if (isThisItemExterna) {
      if (overwriteExisting || !copy.check_externa) {
        copy.check_externa = true;
        copy.data_externa = match.fileDataExterna || item.data_externa || dateToApply;
        copy.usuario_externa = match.fileUsuarioExterna || item.usuario_externa || userToApply;
        copy.motivo_externa = match.fileMotivoExterna || item.motivo_externa || match.fileMotivo || motivoExterna;
        // Ao registrar manutenção externa, limpa calibração interna conforme regra do sistema
        copy.check_calibracao = false;
        copy.data_calibracao = null;
        copy.usuario_calibracao = null;
        copy.check_preventiva = false;
        copy.data_preventiva = null;
        copy.usuario_preventiva = null;
        copy.check_seguranca = false;
        copy.data_seguranca = null;
        copy.usuario_seguranca = null;
        copy.checado = true;
        copy.dataCheck = copy.data_externa;
        copy.conferidoPor = copy.usuario_externa;
        hasChanges = true;
      }
    } else if (targetMode === 'calibracao_completa') {
      // Modo manual: força todas as modalidades selecionadas no modal
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
            copy.check_externa = false;
            hasChanges = true;
          }
        } else if (m === 'seguranca') {
          if (overwriteExisting || !copy.check_seguranca) {
            copy.check_seguranca = true;
            copy.data_seguranca = dateToApply;
            copy.usuario_seguranca = userToApply;
            copy.check_externa = false;
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
    } else {
      // MODO AUTO: Detecção e aplicação inteligente por linha da planilha (com suporte total multiequipes)
      const fileHasCal = Boolean(match.fileCalibracao || item.check_calibracao || effectiveType === 'calibrado' || effectiveType === 'completa');
      const fileHasPrev = Boolean(match.filePreventiva || item.check_preventiva || effectiveType === 'preventiva' || effectiveType === 'completa');
      const fileHasSeg = Boolean(match.fileSeguranca || item.check_seguranca || effectiveType === 'seguranca' || effectiveType === 'completa');

      if (fileHasCal) {
        if (overwriteExisting || !copy.check_calibracao) {
          copy.check_calibracao = true;
          copy.data_calibracao = match.fileDataCalibracao || item.data_calibracao || dateToApply;
          copy.usuario_calibracao = match.fileUsuarioCalibracao || item.usuario_calibracao || userToApply;
          copy.check_externa = false;
          copy.data_externa = null;
          copy.usuario_externa = null;
          copy.motivo_externa = null;
          hasChanges = true;
        }
      }

      if (fileHasPrev) {
        if (overwriteExisting || !copy.check_preventiva) {
          copy.check_preventiva = true;
          copy.data_preventiva = match.fileDataPreventiva || item.data_preventiva || dateToApply;
          copy.usuario_preventiva = match.fileUsuarioPreventiva || item.usuario_preventiva || userToApply;
          copy.check_externa = false;
          hasChanges = true;
        }
      }

      if (fileHasSeg) {
        if (overwriteExisting || !copy.check_seguranca) {
          copy.check_seguranca = true;
          copy.data_seguranca = match.fileDataSeguranca || item.data_seguranca || dateToApply;
          copy.usuario_seguranca = match.fileUsuarioSeguranca || item.usuario_seguranca || userToApply;
          copy.check_externa = false;
          hasChanges = true;
        }
      }

      // Se a planilha tinha um check genérico antigo ou veio de PDF/arquivo simples
      if (!fileHasCal && !fileHasPrev && !fileHasSeg && effectiveType === 'calibracao_completa') {
        modalities.forEach(m => {
          if (m === 'calibracao' && (overwriteExisting || !copy.check_calibracao)) {
            copy.check_calibracao = true;
            copy.data_calibracao = dateToApply;
            copy.usuario_calibracao = userToApply;
            hasChanges = true;
          }
          if (m === 'preventiva' && (overwriteExisting || !copy.check_preventiva)) {
            copy.check_preventiva = true;
            copy.data_preventiva = dateToApply;
            copy.usuario_preventiva = userToApply;
            hasChanges = true;
          }
          if (m === 'seguranca' && (overwriteExisting || !copy.check_seguranca)) {
            copy.check_seguranca = true;
            copy.data_seguranca = dateToApply;
            copy.usuario_seguranca = userToApply;
            hasChanges = true;
          }
        });
      }

      if (hasChanges) {
        copy.check_externa = false;
        copy.checado = Boolean(copy.check_calibracao || copy.check_preventiva || copy.check_seguranca);
        copy.dataCheck = copy.data_calibracao || copy.data_preventiva || copy.data_seguranca || dateToApply;
        copy.conferidoPor = copy.usuario_calibracao || copy.usuario_preventiva || copy.usuario_seguranca || userToApply;
      }
    }

    // Setor de Retirada / Movimentação física da bomba
    const newSector = match.fileSetorRetirada || item.setor_retirada || match.fileSector;
    if (newSector && newSector.trim()) {
      if (overwriteExisting || !copy.setor_retirada || copy.setor_retirada !== newSector) {
        copy.setor_retirada = newSector;
        if (match.fileDataRetirada || item.data_retirada) {
          copy.data_retirada = match.fileDataRetirada || item.data_retirada;
        }
        if (match.fileUsuarioRetirada || item.usuario_retirada) {
          copy.usuario_retirada = match.fileUsuarioRetirada || item.usuario_retirada;
        }
        hasChanges = true;
      }
    }

    // Observações adicionais
    const obsToAdd = (item.observacao && String(item.observacao).trim() !== 'N/A') ? String(item.observacao).trim() : '';
    if (obsToAdd) {
      if (!copy.observacao) {
        copy.observacao = obsToAdd;
        hasChanges = true;
      } else if (!copy.observacao.includes(obsToAdd)) {
        copy.observacao = `${copy.observacao} | ${obsToAdd}`;
        hasChanges = true;
      }
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
