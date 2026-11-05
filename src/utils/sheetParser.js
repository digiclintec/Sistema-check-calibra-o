import * as XLSX from 'xlsx';

/**
 * Normaliza strings para comparação flexível (remove acentos, espaços extras e lowercase)
 */
export function normalizeHeader(str) {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Avalia se o valor preenchido na célula indica status concluído / checado
 */
export function parseCheckValue(val) {
  if (val === true || val === 1) return true;
  if (!val) return false;
  
  const str = String(val).trim().toLowerCase();
  if (
    str === 'sim' ||
    str === 's' ||
    str === 'ok' ||
    str === 'true' ||
    str === 'x' ||
    str === 'v' ||
    str === 'checado' ||
    str === 'conferido' ||
    str === 'concluido' ||
    str === 'concluído' ||
    str === 'realizado' ||
    str === 'feito' ||
    str === 'executado' ||
    str === 'aprovado' ||
    str === 'calibrado' ||
    str === 'pass' ||
    str === 'passed' ||
    str === 'sim/ok' ||
    str.includes('concluid') ||
    str.includes('realizad') ||
    str.includes('conferid') ||
    str.includes('ok')
  ) {
    return true;
  }

  // Se a célula contém uma data (ex: 04/11/2026), significa que foi realizado naquela data
  if (str.length >= 8 && /\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4}/.test(str)) {
    return true;
  }

  return false;
}

/**
 * Converte valor de data (texto BR, ISO ou Date) para formato ISO
 */
export function parseDateValue(val) {
  if (!val) return null;
  if (val instanceof Date && !isNaN(val.getTime())) {
    return val.toISOString();
  }
  const str = String(val).trim();
  if (!str) return null;

  // DD/MM/AAAA ou DD/MM/AAAA HH:mm:ss
  const brMatch = str.match(/^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{2,4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (brMatch) {
    const day = parseInt(brMatch[1], 10);
    const month = parseInt(brMatch[2], 10) - 1;
    let year = parseInt(brMatch[3], 10);
    if (year < 100) year += 2000;
    const hour = brMatch[4] ? parseInt(brMatch[4], 10) : 12;
    const min = brMatch[5] ? parseInt(brMatch[5], 10) : 0;
    const sec = brMatch[6] ? parseInt(brMatch[6], 10) : 0;
    const d = new Date(year, month, day, hour, min, sec);
    if (!isNaN(d.getTime())) return d.toISOString();
  }

  const d = new Date(str);
  if (!isNaN(d.getTime())) return d.toISOString();
  return str;
}

/**
 * Mapeamento inteligente de colunas em planilhas brutas ou semi-tratadas
 */
export function identifyColumns(headers) {
  const mapping = {
    codigoBarras: null,
    tag: null,
    equipamento: null,
    fabricante: null,
    modelo: null,
    serie: null,
    setor: null,
    validadeCalibracao: null,
    statusCalibracao: null,
    checadoGeral: null,
    
    // Frentes individuais (Multiequipes / Semi-tratadas)
    checkCalibracao: null,
    dataCalibracao: null,
    usuarioCalibracao: null,
    certificadoCalibracao: null,

    checkPreventiva: null,
    dataPreventiva: null,
    usuarioPreventiva: null,

    checkSeguranca: null,
    dataSeguranca: null,
    usuarioSeguranca: null,

    usuarioGeral: null,
    dataGeral: null,
    observacao: null,
    os: null,
  };

  headers.forEach((h) => {
    const norm = normalizeHeader(h);
    if (!norm) return;

    // --- FRENTE 1: CALIBRAÇÃO (Detecção Prioritária) ---
    // Data da calibração
    if (!mapping.dataCalibracao && (
      (norm.includes('data') || norm.includes('dt')) && (norm.includes('calibr') || norm.includes('calib'))
    )) {
      mapping.dataCalibracao = h;
    }
    // Responsável / Técnico da calibração
    else if (!mapping.usuarioCalibracao && (
      (norm.includes('tecnico') || norm.includes('resp') || norm.includes('executor') || norm.includes('usuario')) &&
      (norm.includes('calibr') || norm.includes('calib'))
    )) {
      mapping.usuarioCalibracao = h;
    }
    // Certificado / Laudo / Relatório de calibração
    else if (!mapping.certificadoCalibracao && (
      norm.includes('certif') || norm.includes('laudo') || (norm.includes('relatorio') && norm.includes('calibr'))
    )) {
      mapping.certificadoCalibracao = h;
    }
    // Check / Status da calibração (ex: "CALIBRAÇÃO - Status", "CALIBRAÇÃO", "CALIBRADO", "CHECK CALIBRAÇÃO")
    else if (!mapping.checkCalibracao && (
      (norm.includes('calibr') || norm.includes('calib')) &&
      (norm.includes('status') || norm.includes('check') || norm.includes('situacao') || norm.includes('ok') || norm === 'calibracao' || norm === 'calibrado' || norm === 'calib')
    )) {
      mapping.checkCalibracao = h;
    }

    // --- FRENTE 2: MANUTENÇÃO PREVENTIVA ---
    // Data da preventiva
    else if (!mapping.dataPreventiva && (
      (norm.includes('data') || norm.includes('dt')) && (norm.includes('preventiv') || norm.includes('mp'))
    )) {
      mapping.dataPreventiva = h;
    }
    // Responsável / Técnico da preventiva
    else if (!mapping.usuarioPreventiva && (
      (norm.includes('tecnico') || norm.includes('resp') || norm.includes('executor') || norm.includes('usuario')) &&
      (norm.includes('preventiv') || norm.includes('mp'))
    )) {
      mapping.usuarioPreventiva = h;
    }
    // Check / Status da preventiva (ex: "PREVENTIVA - Status", "PREVENTIVA", "MANUTENÇÃO PREVENTIVA", "CHECK PREVENTIVA", "MP")
    else if (!mapping.checkPreventiva && (
      (norm.includes('preventiv') || norm.includes('mp') || norm.includes('manutencao')) &&
      (norm.includes('status') || norm.includes('check') || norm.includes('situacao') || norm.includes('ok') || norm === 'preventiva' || norm === 'mp' || norm === 'manutencaopreventiva')
    )) {
      mapping.checkPreventiva = h;
    }

    // --- FRENTE 3: TESTE DE SEGURANÇA ELÉTRICA (TSE) ---
    // Data da segurança
    else if (!mapping.dataSeguranca && (
      (norm.includes('data') || norm.includes('dt')) && (norm.includes('seguranc') || norm.includes('tse') || norm.includes('eletric'))
    )) {
      mapping.dataSeguranca = h;
    }
    // Responsável / Técnico da segurança
    else if (!mapping.usuarioSeguranca && (
      (norm.includes('tecnico') || norm.includes('resp') || norm.includes('executor') || norm.includes('usuario')) &&
      (norm.includes('seguranc') || norm.includes('tse'))
    )) {
      mapping.usuarioSeguranca = h;
    }
    // Check / Status da segurança elétrica (ex: "SEG. ELÉTRICA - Status", "SEGURANÇA ELÉTRICA", "TSE")
    else if (!mapping.checkSeguranca && (
      (norm.includes('seguranc') || norm.includes('tse') || norm.includes('eletric')) &&
      (norm.includes('status') || norm.includes('check') || norm.includes('situacao') || norm.includes('ok') || norm === 'seguranca' || norm === 'tse' || norm === 'segeletrica' || norm === 'segurancaeletrica')
    )) {
      mapping.checkSeguranca = h;
    }

    // --- CAMPOS DE IDENTIFICAÇÃO BÁSICA ---
    // Tag / Identificador / IDEC / Tombamento / Patrimônio
    else if (!mapping.tag && (
      norm.includes('tag') || 
      norm.includes('idec') ||
      norm.includes('identifica') || 
      norm.includes('identificador') || 
      norm.includes('patrimonio') ||
      norm.includes('tombamento') ||
      norm.includes('codigoequipamento')
    )) {
      mapping.tag = h;
    }
    // Código de barras
    else if (!mapping.codigoBarras && (
      norm.includes('codigobarras') ||
      norm.includes('codbarras') ||
      norm.includes('barcode') ||
      norm.includes('ean') ||
      norm.includes('cbarras')
    )) {
      mapping.codigoBarras = h;
    }
    // Número de série
    else if (!mapping.serie && (
      norm.includes('serie') || 
      norm.includes('serial') || 
      norm.includes('sn') || 
      norm === 'ns' || 
      norm.includes('ndeserie') ||
      norm.includes('numerodeserie')
    )) {
      mapping.serie = h;
    }
    // Equipamento / Descrição / Instrumento / Tipo
    else if (!mapping.equipamento && (
      norm.includes('equipamento') ||
      norm.includes('instrumento') ||
      norm.includes('aparelho') ||
      norm.includes('descricao') ||
      norm.includes('nome') ||
      norm.includes('tipo') ||
      norm.includes('item')
    )) {
      mapping.equipamento = h;
    }
    // Fabricante / Marca
    else if (!mapping.fabricante && (norm.includes('fabricante') || norm.includes('marca'))) {
      mapping.fabricante = h;
    }
    // Modelo
    else if (!mapping.modelo && (norm.includes('modelo') || norm === 'mod' || norm === 'ref')) {
      mapping.modelo = h;
    }
    // Setor / Localização
    else if (!mapping.setor && (
      norm.includes('setor') ||
      norm.includes('local') ||
      norm.includes('departamento') ||
      norm.includes('unidade') ||
      norm.includes('sala') ||
      norm.includes('posto') ||
      norm.includes('area')
    )) {
      mapping.setor = h;
    }
    // Validade / Vencimento da Calibração
    else if (!mapping.validadeCalibracao && (
      norm.includes('validade') ||
      norm.includes('vencimento') ||
      norm.includes('proximacalibracao') ||
      norm.includes('proxcalibracao')
    )) {
      mapping.validadeCalibracao = h;
    }
    // Status Geral de Calibração (ex: "Status Calibração")
    else if (!mapping.statusCalibracao && (
      norm.includes('statuscalibracao') || 
      (norm.includes('status') && !norm.includes('geral') && !norm.includes('prev') && !norm.includes('seg'))
    )) {
      mapping.statusCalibracao = h;
    }
    // Checado Geral / Status Geral / Check
    else if (!mapping.checadoGeral && (
      norm.includes('statusgeral') ||
      norm.includes('checado') || 
      norm.includes('conferido') || 
      norm.includes('check') || 
      norm.includes('verificado') ||
      norm === 'status' ||
      norm === 'situacao'
    )) {
      mapping.checadoGeral = h;
    }
    // Usuário / Técnico Geral
    else if (!mapping.usuarioGeral && (
      norm.includes('tecnico') || 
      norm.includes('responsavel') || 
      norm.includes('executor') || 
      norm.includes('conferidopor') ||
      norm.includes('usuario')
    )) {
      mapping.usuarioGeral = h;
    }
    // Data Geral
    else if (!mapping.dataGeral && (
      norm === 'data' || 
      norm === 'dt' || 
      norm.includes('datacheck') || 
      norm.includes('dataconferencia')
    )) {
      mapping.dataGeral = h;
    }
    // Ordem de Serviço (OS)
    else if (!mapping.os && (
      norm === 'os' || 
      norm === 'numos' || 
      norm === 'noos' || 
      norm.includes('ordemdeservico') || 
      norm.includes('ordemservico')
    )) {
      mapping.os = h;
    }
    // Observação
    else if (!mapping.observacao && (
      norm.includes('observacao') || 
      norm.includes('obs') || 
      norm.includes('nota') ||
      norm.includes('defeito')
    )) {
      mapping.observacao = h;
    }
  });

  // Fallbacks inteligentes se colunas essenciais não tiverem nome padrão:
  if (!mapping.codigoBarras && mapping.serie) {
    mapping.codigoBarras = mapping.serie;
  } else if (!mapping.codigoBarras && mapping.tag) {
    mapping.codigoBarras = mapping.tag;
  } else if (!mapping.codigoBarras && headers.length > 0) {
    mapping.codigoBarras = headers[0];
  }

  if (!mapping.equipamento && headers.length > 1) {
    mapping.equipamento = headers[1];
  } else if (!mapping.equipamento && headers.length > 0) {
    mapping.equipamento = headers[0];
  }

  return mapping;
}

/**
 * Converte linhas brutas da planilha em objetos de Equipamento normalizados
 */
export function normalizeRows(rows, mapping) {
  return rows.map((row, idx) => {
    const rawBarcode = mapping.codigoBarras ? String(row[mapping.codigoBarras] ?? '').trim() : '';
    const rawTag = mapping.tag ? String(row[mapping.tag] ?? '').trim() : '';
    const rawEquipamento = mapping.equipamento ? String(row[mapping.equipamento] ?? '').trim() : `Equipamento #${idx + 1}`;
    const rawFabricante = mapping.fabricante ? String(row[mapping.fabricante] ?? '').trim() : '';
    const rawModelo = mapping.modelo ? String(row[mapping.modelo] ?? '').trim() : '';
    const rawSerie = mapping.serie ? String(row[mapping.serie] ?? '').trim() : '';
    const rawSetor = mapping.setor ? String(row[mapping.setor] ?? '').trim() : 'Geral';
    const rawValidade = mapping.validadeCalibracao ? String(row[mapping.validadeCalibracao] ?? '').trim() : '';
    const rawStatus = mapping.statusCalibracao ? String(row[mapping.statusCalibracao] ?? '').trim() : '';
    
    // Status Geral ou Legado
    const rawChecadoGeral = mapping.checadoGeral ? row[mapping.checadoGeral] : false;
    const isChecadoGeral = parseCheckValue(rawChecadoGeral);

    // FRENTE 1: CALIBRAÇÃO
    const hasCalCol = Boolean(mapping.checkCalibracao);
    const rawCheckCal = hasCalCol ? row[mapping.checkCalibracao] : null;
    const isCalChecked = hasCalCol ? parseCheckValue(rawCheckCal) : isChecadoGeral;
    
    let dataCal = mapping.dataCalibracao ? parseDateValue(row[mapping.dataCalibracao]) : null;
    if (!dataCal && isCalChecked) {
      dataCal = parseDateValue(rawCheckCal) || (mapping.dataGeral ? parseDateValue(row[mapping.dataGeral]) : null) || new Date().toISOString();
    }
    const userCal = mapping.usuarioCalibracao ? String(row[mapping.usuarioCalibracao] ?? '').trim() : (mapping.usuarioGeral ? String(row[mapping.usuarioGeral] ?? '').trim() : null);

    // FRENTE 2: PREVENTIVA
    const hasPrevCol = Boolean(mapping.checkPreventiva);
    const rawCheckPrev = hasPrevCol ? row[mapping.checkPreventiva] : null;
    const isPrevChecked = hasPrevCol ? parseCheckValue(rawCheckPrev) : false;

    let dataPrev = mapping.dataPreventiva ? parseDateValue(row[mapping.dataPreventiva]) : null;
    if (!dataPrev && isPrevChecked) {
      dataPrev = parseDateValue(rawCheckPrev) || (mapping.dataGeral ? parseDateValue(row[mapping.dataGeral]) : null) || new Date().toISOString();
    }
    const userPrev = mapping.usuarioPreventiva ? String(row[mapping.usuarioPreventiva] ?? '').trim() : (mapping.usuarioGeral ? String(row[mapping.usuarioGeral] ?? '').trim() : null);

    // FRENTE 3: SEGURANÇA ELÉTRICA
    const hasSegCol = Boolean(mapping.checkSeguranca);
    const rawCheckSeg = hasSegCol ? row[mapping.checkSeguranca] : null;
    const isSegChecked = hasSegCol ? parseCheckValue(rawCheckSeg) : false;

    let dataSeg = mapping.dataSeguranca ? parseDateValue(row[mapping.dataSeguranca]) : null;
    if (!dataSeg && isSegChecked) {
      dataSeg = parseDateValue(rawCheckSeg) || (mapping.dataGeral ? parseDateValue(row[mapping.dataGeral]) : null) || new Date().toISOString();
    }
    const userSeg = mapping.usuarioSeguranca ? String(row[mapping.usuarioSeguranca] ?? '').trim() : (mapping.usuarioGeral ? String(row[mapping.usuarioGeral] ?? '').trim() : null);

    // Observações, OS e Certificados
    let rawObs = mapping.observacao ? String(row[mapping.observacao] ?? '').trim() : '';
    if (mapping.os && row[mapping.os]) {
      const osVal = `OS: ${String(row[mapping.os]).trim()}`;
      if (!rawObs.includes(osVal)) {
        rawObs = rawObs ? `${rawObs} | ${osVal}` : osVal;
      }
    }
    if (mapping.certificadoCalibracao && row[mapping.certificadoCalibracao]) {
      const certVal = `Certificado: ${String(row[mapping.certificadoCalibracao]).trim()}`;
      if (!rawObs.includes(certVal)) {
        rawObs = rawObs ? `${rawObs} | ${certVal}` : certVal;
      }
    }

    // Determina status de validade da calibração se não vier explícito
    let calculatedStatus = rawStatus;
    if (!calculatedStatus && rawValidade && rawValidade !== 'N/A') {
      const parsedDate = new Date(rawValidade);
      if (!isNaN(parsedDate.getTime())) {
        const today = new Date();
        const diffDays = Math.ceil((parsedDate - today) / (1000 * 60 * 60 * 24));
        if (diffDays < 0) {
          calculatedStatus = 'Vencido';
        } else if (diffDays <= 30) {
          calculatedStatus = 'A Vencer';
        } else {
          calculatedStatus = 'Válido';
        }
      }
    }

    // Resolve nome do equipamento com inteligência se a coluna veio como status ou valor genérico (ex: "Ativo")
    let resolvedEquip = rawEquipamento;
    if (resolvedEquip.toLowerCase() === 'ativo' || resolvedEquip.toLowerCase() === 'inativo' || resolvedEquip.toLowerCase() === 'pendente') {
      if (row['TIPO'] || row['Tipo'] || row['tipo'] || row['DESCRIÇÃO'] || row['Descricao']) {
        resolvedEquip = String(row['TIPO'] || row['Tipo'] || row['tipo'] || row['DESCRIÇÃO'] || row['Descricao']).trim();
      } else if (rawFabricante || rawModelo) {
        resolvedEquip = `${rawFabricante} ${rawModelo}`.trim();
      }
    }

    const uniqueId = rawSerie ? `EQP-${rawSerie}` : (rawTag ? `EQP-${rawTag}` : (rawBarcode ? `EQP-${rawBarcode}` : `EQP-${idx + 1}`));
    const finalBarcode = rawBarcode || rawSerie || rawTag || `CAL-${String(idx + 1).padStart(4, '0')}`;
    const finalTag = rawTag || (row['Identificação'] ? String(row['Identificação']).trim() : `TAG-${String(idx + 1).padStart(3, '0')}`);

    const isGlobalChecked = Boolean(isCalChecked || isPrevChecked || isSegChecked || isChecadoGeral);

    return {
      id: uniqueId,
      codigoBarras: finalBarcode,
      tag: finalTag,
      equipamento: resolvedEquip,
      fabricante: rawFabricante,
      modelo: rawModelo,
      serie: rawSerie,
      setor: rawSetor,
      validadeCalibracao: rawValidade || 'N/A',
      statusCalibracao: calculatedStatus || 'Válido',
      checado: isGlobalChecked,
      dataCheck: dataCal || dataPrev || dataSeg || (isGlobalChecked ? new Date().toISOString() : null),
      observacao: rawObs,
      
      // Suporte multiequipes (Calibração, Preventiva, Segurança Elétrica)
      check_calibracao: Boolean(isCalChecked),
      data_calibracao: dataCal,
      usuario_calibracao: userCal,
      
      check_preventiva: Boolean(isPrevChecked),
      data_preventiva: dataPrev,
      usuario_preventiva: userPrev,

      check_seguranca: Boolean(isSegChecked),
      data_seguranca: dataSeg,
      usuario_seguranca: userSeg,

      _originalRow: row,
    };
  });
}

/**
 * Extrai dados tabulares de qualquer Worksheet procurando a linha real de cabeçalho
 * (mesmo se o arquivo tiver títulos na linha 1 ou 2, ou linhas em branco no topo)
 */
export function extractDataFromWorksheet(worksheet) {
  // Converte em array 2D de linhas
  const rawMatrix = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
  
  if (!rawMatrix || rawMatrix.length === 0) {
    return { rawJson: [], headers: [] };
  }

  // Palavras-chave para identificar a linha real de cabeçalho
  const sampleKeywords = [
    'codigo', 'cod', 'barcode', 'ean', 'patrimonio', 'tag', 'id',
    'equipamento', 'aparelho', 'instrumento', 'descricao', 'nome', 'item',
    'modelo', 'fabricante', 'marca', 'serie', 'serial', 'setor', 'local',
    'validade', 'vencimento', 'calibracao', 'status', 'situacao', 'checado', 'check',
    'preventiva', 'seguranca', 'tse', 'mp', 'tecnico', 'responsavel', 'executor',
    'identificacao', 'idec', 'tombamento', 'ordem'
  ];

  let bestHeaderRowIndex = 0;
  let bestScore = -1;

  for (let i = 0; i < Math.min(rawMatrix.length, 20); i++) {
    const row = rawMatrix[i];
    if (!Array.isArray(row) || row.length === 0) continue;

    const nonEmptyCells = row.filter(cell => String(cell).trim() !== '');
    if (nonEmptyCells.length < 2) continue;

    let score = 0;
    nonEmptyCells.forEach(cell => {
      const norm = normalizeHeader(cell);
      if (sampleKeywords.some(kw => norm.includes(kw))) {
        score += 4;
      } else if (norm.length > 1) {
        score += 1;
      }
    });

    if (score > bestScore) {
      bestScore = score;
      bestHeaderRowIndex = i;
    }
  }

  const rawHeaderRow = rawMatrix[bestHeaderRowIndex] || [];
  const headers = rawHeaderRow.map((h, colIdx) => {
    const val = String(h).trim();
    return val || `Coluna_${colIdx + 1}`;
  });

  const rawJson = [];
  for (let r = bestHeaderRowIndex + 1; r < rawMatrix.length; r++) {
    const row = rawMatrix[r];
    if (!row || row.length === 0) continue;

    const hasData = row.some(cell => String(cell).trim() !== '');
    if (!hasData) continue;

    const rowObj = {};
    headers.forEach((h, colIdx) => {
      rowObj[h] = row[colIdx] !== undefined ? row[colIdx] : '';
    });
    rawJson.push(rowObj);
  }

  return { rawJson, headers, headerRowIndex: bestHeaderRowIndex };
}

/**
 * Lê arquivo Excel (.xlsx, .xls) ou CSV via FileReader (Suporta qualquer arquivo cru)
 */
export async function parseSpreadsheetFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true, dateNF: 'yyyy-mm-dd' });
        
        // Procura a melhor aba (a que tiver mais linhas válidas)
        let chosenSheetName = workbook.SheetNames[0];
        let chosenData = null;

        for (const sName of workbook.SheetNames) {
          const ws = workbook.Sheets[sName];
          const extracted = extractDataFromWorksheet(ws);
          if (!chosenData || extracted.rawJson.length > chosenData.rawJson.length) {
            chosenSheetName = sName;
            chosenData = extracted;
          }
        }

        if (!chosenData || chosenData.rawJson.length === 0) {
          // Fallback para conversão padrão
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const fallbackJson = XLSX.utils.sheet_to_json(firstSheet, { defval: '', raw: false });
          if (!fallbackJson || fallbackJson.length === 0) {
            throw new Error('A planilha está vazia ou não contém dados legíveis.');
          }
          const headers = Object.keys(fallbackJson[0]);
          const mapping = identifyColumns(headers);
          const normalized = normalizeRows(fallbackJson, mapping);
          return resolve({
            fileName: file.name,
            sheetName: workbook.SheetNames[0],
            allSheets: workbook.SheetNames,
            headers,
            mapping,
            equipments: normalized,
            total: normalized.length
          });
        }

        const mapping = identifyColumns(chosenData.headers);
        const normalized = normalizeRows(chosenData.rawJson, mapping);

        resolve({
          fileName: file.name,
          sheetName: chosenSheetName,
          allSheets: workbook.SheetNames,
          headers: chosenData.headers,
          mapping,
          equipments: normalized,
          total: normalized.length
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
 * Converte link do Google Sheets ou Google Drive para URL de exportação direta
 */
export function extractGoogleSheetsExportUrl(inputUrl) {
  if (!inputUrl) return null;

  if (inputUrl.includes('output=csv') || inputUrl.includes('format=csv')) {
    return inputUrl;
  }

  // Detecta ID do arquivo tanto em docs.google.com quanto em drive.google.com
  const match = inputUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/) ||
                inputUrl.match(/\/file\/d\/([a-zA-Z0-9-_]+)/) ||
                inputUrl.match(/[?&]id=([a-zA-Z0-9-_]+)/);

  if (match && match[1]) {
    const spreadsheetId = match[1];
    const gidMatch = inputUrl.match(/[#&?]gid=([0-9]+)/);
    const gidParam = gidMatch ? `&gid=${gidMatch[1]}` : '';
    return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv${gidParam}`;
  }

  return inputUrl;
}

/**
 * Lê CSV texto (seja vindo de fetch do Google Sheets ou colado diretamente)
 */
export function parseCsvText(csvText, sourceName = 'Google Sheets') {
  const workbook = XLSX.read(csvText, { type: 'string', cellDates: true });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  
  const extracted = extractDataFromWorksheet(worksheet);
  let rawJson = extracted.rawJson;
  let headers = extracted.headers;

  if (!rawJson || rawJson.length === 0) {
    rawJson = XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: false });
    if (!rawJson || rawJson.length === 0) {
      throw new Error('Nenhum dado encontrado no CSV ou conteúdo colado.');
    }
    headers = Object.keys(rawJson[0]);
  }

  const mapping = identifyColumns(headers);
  const normalized = normalizeRows(rawJson, mapping);

  return {
    fileName: sourceName,
    sheetName: firstSheetName,
    headers,
    mapping,
    equipments: normalized,
    total: normalized.length
  };
}

/**
 * Exporta os dados atuais para um arquivo .xlsx baixável com suporte completo a multiequipes
 */
export function exportToExcel(equipments, fileName = 'conferencia_multiequipes.xlsx', modality = 'geral') {
  const exportData = equipments.map((item, idx) => {
    const isCalOk = Boolean(item.check_calibracao !== undefined ? item.check_calibracao : item.checado);
    const isPrevOk = Boolean(item.check_preventiva);
    const isSegOk = Boolean(item.check_seguranca);

    let statusGeral = 'PENDENTE';
    if (isCalOk && isPrevOk && isSegOk) {
      statusGeral = '100% CONCLUÍDO (3 Frentes)';
    } else if (isCalOk || isPrevOk || isSegOk) {
      const feitas = [];
      if (isCalOk) feitas.push('Calibração');
      if (isPrevOk) feitas.push('Preventiva');
      if (isSegOk) feitas.push('Segurança');
      statusGeral = `PARCIAL (${feitas.join(' + ')})`;
    }

    return {
      'Ordem': idx + 1,
      'Código de Barras': item.codigoBarras,
      'Tag / IDEC': item.tag,
      'Equipamento': item.equipamento,
      'Fabricante': item.fabricante || '',
      'Modelo': item.modelo || '',
      'Nº de Série': item.serie || '',
      'Setor': item.setor || '',
      'Validade Calibração': item.validadeCalibracao || '',
      'Status Calibração': item.statusCalibracao || '',
      
      // FRENTE 1: CALIBRAÇÃO
      'CALIBRAÇÃO - Status': isCalOk ? 'CONFERIDO / OK' : 'PENDENTE',
      'CALIBRAÇÃO - Data/Hora': item.data_calibracao ? new Date(item.data_calibracao).toLocaleString('pt-BR') : (isCalOk && item.dataCheck ? new Date(item.dataCheck).toLocaleString('pt-BR') : ''),
      'CALIBRAÇÃO - Responsável': item.usuario_calibracao || (isCalOk ? item.conferidoPor : '') || '',

      // FRENTE 2: MANUTENÇÃO PREVENTIVA
      'PREVENTIVA - Status': isPrevOk ? 'CONFERIDO / OK' : 'PENDENTE',
      'PREVENTIVA - Data/Hora': item.data_preventiva ? new Date(item.data_preventiva).toLocaleString('pt-BR') : '',
      'PREVENTIVA - Responsável': item.usuario_preventiva || '',

      // FRENTE 3: TESTE DE SEGURANÇA ELÉTRICA (TSE)
      'SEG. ELÉTRICA - Status': isSegOk ? 'CONFERIDO / OK' : 'PENDENTE',
      'SEG. ELÉTRICA - Data/Hora': item.data_seguranca ? new Date(item.data_seguranca).toLocaleString('pt-BR') : '',
      'SEG. ELÉTRICA - Responsável': item.usuario_seguranca || '',

      // STATUS GERAL UNIFICADO
      'STATUS GERAL': statusGeral,
      'Observações': item.observacao || ''
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  
  const colWidths = [
    { wch: 8 },  // Ordem
    { wch: 18 }, // Código de Barras
    { wch: 16 }, // Tag
    { wch: 32 }, // Equipamento
    { wch: 16 }, // Fabricante
    { wch: 16 }, // Modelo
    { wch: 18 }, // Série
    { wch: 20 }, // Setor
    { wch: 16 }, // Validade
    { wch: 16 }, // Status
    { wch: 20 }, // Calibração Status
    { wch: 22 }, // Calibração Data
    { wch: 26 }, // Calibração Resp
    { wch: 20 }, // Preventiva Status
    { wch: 22 }, // Preventiva Data
    { wch: 26 }, // Preventiva Resp
    { wch: 20 }, // Seg Status
    { wch: 22 }, // Seg Data
    { wch: 26 }, // Seg Resp
    { wch: 26 }, // Status Geral
    { wch: 30 }  // Observações
  ];
  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Conferência Hospitalar');

  XLSX.writeFile(workbook, fileName);
}
