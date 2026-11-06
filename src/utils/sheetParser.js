import * as XLSX from 'xlsx';
import { exportStyledEquipmentsExcel } from './excelExporter.js';

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

  // Casos negativos explícitos (nunca marcar como check)
  if (
    str === 'pendente' ||
    str === 'aguardando' ||
    str === 'a fazer' ||
    str === 'a conferir' ||
    str === 'nao' ||
    str === 'não' ||
    str === 'false' ||
    str === '0' ||
    str === 'n' ||
    str === 'aberto' ||
    str.includes('nao checado') ||
    str.includes('não checado') ||
    str.includes('sem check') ||
    str.includes('desmarcado')
  ) {
    return false;
  }

  // Casos positivos explícitos
  if (
    str === 'sim' ||
    str === 's' ||
    str === 'ok' ||
    str === 'true' ||
    str === 'x' ||
    str === 'v' ||
    str === 'check' ||
    str === 'checked' ||
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
    str === 'ok/check' ||
    str === 'validado' ||
    str.includes('check') ||
    str.includes('concluid') ||
    str.includes('realizad') ||
    str.includes('conferid') ||
    str.includes('validad') ||
    str.includes('aprovad') ||
    str.includes('calibrad') ||
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
 * Detecta se um texto ou célula indica Manutenção (em manutenção, manutenção externa, conserto, reparo, oficina, etc.)
 */
export function isMaintenanceExternalText(rawVal) {
  if (!rawVal) return false;
  const s = String(rawVal)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
  if (!s) return false;

  // Exclui preventiva explícita (ex: "Manutenção Preventiva", "MP", "Prev")
  if (s.includes('preventiv') || s === 'mp' || s === 'prev') return false;

  // Termos diretos que caracterizam Manutenção / Manutenção Externa
  if (
    s.includes('manut') ||
    s.includes('extern') ||
    s.includes('terceir') ||
    s.includes('conserto') ||
    s.includes('reparo') ||
    s.includes('corretiv') ||
    s.includes('assistenc') ||
    s.includes('oficina') ||
    s.includes('bancada') ||
    s.includes('recolhid') ||
    s.includes('defeito') ||
    s.includes('quebrad') ||
    s.includes('avariad') ||
    s.includes('aguardando') ||
    s.includes('fora de uso') ||
    s.includes('fora da unidade') ||
    s.includes('fora do hosp')
  ) {
    return true;
  }

  return false;
}

/**
 * Detecta se um texto indica especificamente Manutenção Preventiva (Prev, Preventiva, MP)
 */
export function isPrevOnlyText(rawVal) {
  if (!rawVal) return false;
  const s = String(rawVal)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
  if (!s) return false;
  return (
    s === 'prev' ||
    s === 'mp' ||
    s === 'preventiva' ||
    s === 'preventivada' ||
    s === 'preventivado' ||
    s === 'somente prev' ||
    s === 'so prev' ||
    s === 'manutencao preventiva' ||
    s.includes('manutencao preventiva') ||
    (s.includes('prev') && !s.includes('calibrad') && !s.includes('tse'))
  );
}

/**
 * Detecta se um texto indica especificamente Teste de Segurança Elétrica (TSE, Seg. Elétrica, Segurança)
 */
export function isTseOnlyText(rawVal) {
  if (!rawVal) return false;
  const s = String(rawVal)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
  if (!s) return false;
  return (
    s === 'tse' ||
    s === 'somente tse' ||
    s === 'so tse' ||
    s === 'seguranca' ||
    s === 'seguranca eletrica' ||
    s === 'teste seguranca' ||
    s === 'teste de seguranca' ||
    s === 'eletrica' ||
    (s.includes('tse') && !s.includes('calibrad') && !s.includes('prev'))
  );
}

/**
 * Detecta se um texto indica Calibração (Calibrado, Calibração, Cal)
 */
export function isCalibradoText(rawVal) {
  if (!rawVal) return false;
  const s = String(rawVal)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
  if (!s) return false;
  return (
    s === 'calibrado' ||
    s === 'calibrada' ||
    s === 'calibrados' ||
    s === 'calibradas' ||
    s === 'calibracao' ||
    s === 'cal' ||
    s.includes('calibrad') ||
    s.includes('calibrac') ||
    s === 'check' ||
    s === 'ok' ||
    s === 'sim'
  );
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
 * com Suporte a Deep Content Awareness (detecção por conteúdo real das células)
 */
export function identifyColumns(headers, sampleRows = []) {
  const mapping = {
    codigoBarras: null,
    tag: null,
    equipamento: null,
    fabricante: null,
    modelo: null,
    serie: null,
    setor: null,
    setorRetirada: null,
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

    // Frente 4: Manutenção Externa / Terceirizada
    checkExterna: null,
    dataExterna: null,
    usuarioExterna: null,
    motivoExterna: null,

    usuarioGeral: null,
    dataGeral: null,
    observacao: null,
    os: null,
  };

  headers.forEach((h) => {
    const norm = normalizeHeader(h);
    if (!norm) return;

    // --- FRENTE 1: CALIBRAÇÃO (Detecção Prioritária) ---
    // Status de validade do certificado (ex: "Status Calibração", "Situação Calibração")
    if (!mapping.statusCalibracao && (
      norm.startsWith('statuscalibr') ||
      norm === 'statuscalibracao' ||
      norm === 'situacaocalibracao'
    )) {
      mapping.statusCalibracao = h;
    }
    // Data da calibração
    else if (!mapping.dataCalibracao && (
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
    // Check / Execução da calibração (ex: "CALIBRAÇÃO - Status", "CALIBRAÇÃO", "CALIBRADO", "CHECK CALIBRAÇÃO")
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
      (norm.includes('data') || norm.includes('dt')) && (norm.includes('seguranc') || norm.includes('seg') || norm.includes('tse') || norm.includes('eletric'))
    )) {
      mapping.dataSeguranca = h;
    }
    // Responsável / Técnico da segurança
    else if (!mapping.usuarioSeguranca && (
      (norm.includes('tecnico') || norm.includes('resp') || norm.includes('executor') || norm.includes('usuario')) &&
      (norm.includes('seguranc') || norm.includes('seg') || norm.includes('tse') || norm.includes('eletric'))
    )) {
      mapping.usuarioSeguranca = h;
    }
    // Check / Status da segurança elétrica (ex: "SEG. ELÉTRICA - Status", "SEGURANÇA ELÉTRICA", "TSE")
    else if (!mapping.checkSeguranca && (
      (norm.includes('seguranc') || norm.includes('seg') || norm.includes('tse') || norm.includes('eletric')) &&
      (norm.includes('status') || norm.includes('check') || norm.includes('situacao') || norm.includes('ok') || norm === 'seguranca' || norm === 'tse' || norm === 'segeletrica' || norm === 'segurancaeletrica')
    )) {
      mapping.checkSeguranca = h;
    }

    // --- FRENTE 4: MANUTENÇÃO EXTERNA / TERCEIRIZADA ---
    // Data da manutenção externa
    else if (!mapping.dataExterna && (
      (norm.includes('data') || norm.includes('dt')) && (norm.includes('extern') || norm.includes('terceir') || norm.includes('envio'))
    )) {
      mapping.dataExterna = h;
    }
    // Responsável / Empresa / Técnico da manutenção externa
    else if (!mapping.usuarioExterna && (
      (norm.includes('tecnico') || norm.includes('resp') || norm.includes('empresa') || norm.includes('laboratorio') || norm.includes('fornecedor') || norm.includes('usuario')) &&
      (norm.includes('extern') || norm.includes('terceir'))
    )) {
      mapping.usuarioExterna = h;
    }
    // Motivo / Destino da manutenção externa
    else if (!mapping.motivoExterna && (
      (norm.includes('motivo') || norm.includes('destino') || norm.includes('justificativa') || norm.includes('defeito') || norm.includes('laudo')) &&
      (norm.includes('extern') || norm.includes('terceir') || norm.includes('conserto') || norm.includes('envio'))
    )) {
      mapping.motivoExterna = h;
    }
    // Check / Status de manutenção (ex: "MANUTENÇÃO", "EM MANUTENÇÃO", "MANUT", "MANUT. EXTERNA", "EXTERNA", "TERCEIRIZADA", "CONSERTO", "CHECK EXTERNA")
    else if (!mapping.checkExterna && !norm.includes('preventiv') && (
      norm === 'manutencao' ||
      norm === 'emmanutencao' ||
      norm === 'manut' ||
      norm === 'emmanut' ||
      norm === 'externa' ||
      norm === 'manutencaoexterna' ||
      norm === 'manutexterna' ||
      norm === 'conserto' ||
      norm === 'reparo' ||
      norm.includes('extern') ||
      norm.includes('terceir') ||
      (norm.includes('manut') && (norm.includes('status') || norm.includes('check') || norm.includes('situacao') || norm.includes('ok') || norm.includes('em')))
    )) {
      mapping.checkExterna = h;
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
      norm.includes('codigodebarras') ||
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
    // Setor de Retirada / Coleta (Bomba retirada de outro setor ou segunda coluna de setor)
    else if (!mapping.setorRetirada && (
      norm.includes('retirad') ||
      norm.includes('colet') ||
      norm.includes('origem') ||
      (norm.includes('setor') && mapping.setor && mapping.setor !== h)
    )) {
      mapping.setorRetirada = h;
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
      (norm.includes('status') && !norm.includes('geral') && !norm.includes('prev') && !norm.includes('seg') && !norm.includes('estado'))
    )) {
      mapping.statusCalibracao = h;
    }
    // Checado Geral / Status Geral / Check / Estado de Conferência
    else if (!mapping.checadoGeral && (
      norm.includes('statusgeral') ||
      norm.includes('checado') || 
      norm.includes('conferido') || 
      norm.includes('check') || 
      norm.includes('verificado') ||
      norm.includes('estadopendente') ||
      norm.includes('pendente') ||
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
      norm.includes('defeito') ||
      norm.includes('motivo')
    )) {
      mapping.observacao = h;
    }
  });

  // --- DEEP CONTENT-AWARE INSPECTION: Analisa o conteúdo real das células ---
  if (Array.isArray(sampleRows) && sampleRows.length > 0) {
    const inspectRows = sampleRows.slice(0, 100);

    // Avalia se o checadoGeral atual possui tokens de conferência reais
    let currentCheckTokens = 0;
    if (mapping.checadoGeral) {
      for (const row of inspectRows) {
        const val = String(row[mapping.checadoGeral] || '').trim().toLowerCase();
        if (val === 'check' || val === 'checked' || val.includes('check') || val === 'pendente' || val === 'ok' || val === 'conferido' || val === 'calibrado') {
          currentCheckTokens++;
        }
      }
    }

    // Se o checadoGeral atual não tiver tokens suficientes ou não foi mapeado, procura a melhor coluna por conteúdo
    if (currentCheckTokens < 2 || !mapping.checadoGeral) {
      let bestCheckCol = null;
      let maxCheckMatches = 0;

      headers.forEach(h => {
        if (h === mapping.serie || h === mapping.tag || h === mapping.codigoBarras || h === mapping.equipamento || h === mapping.modelo || h === mapping.fabricante || h === mapping.setor || h === mapping.setorRetirada) {
          return;
        }

        let matchCount = 0;
        for (const row of inspectRows) {
          const val = String(row[h] || '').trim().toLowerCase();
          if (
            val === 'check' || 
            val === 'checked' || 
            val.includes('check') || 
            val === 'pendente' || 
            val === 'ok' || 
            val === 'conferido' || 
            val === 'calibrado' ||
            val === 'sim' ||
            val === 'nao' ||
            val === 'não'
          ) {
            matchCount++;
          }
        }

        if (matchCount > maxCheckMatches && matchCount >= 2) {
          maxCheckMatches = matchCount;
          bestCheckCol = h;
        }
      });

      if (bestCheckCol) {
        mapping.checadoGeral = bestCheckCol;
      }
    }

    // 2. Identificar coluna de Setor de Retirada (Coleta) se houver segunda coluna de setor
    if (!mapping.setorRetirada) {
      headers.forEach(h => {
        if (h === mapping.setor || h === mapping.serie || h === mapping.tag || h === mapping.equipamento || h === mapping.checadoGeral) {
          return;
        }
        const norm = normalizeHeader(h);
        if (norm.includes('retirad') || norm.includes('colet') || norm.includes('origem') || norm === 'setor') {
          mapping.setorRetirada = h;
        }
      });
    }

    // 3. Identificar coluna de Observação se houver coluna com defeitos / notas (ex: "MANUTENÇÃO EXTERNA")
    if (!mapping.observacao) {
      headers.forEach(h => {
        if (h === mapping.setor || h === mapping.setorRetirada || h === mapping.checadoGeral || h === mapping.tag || h === mapping.serie || h === mapping.equipamento) {
          return;
        }
        const norm = normalizeHeader(h);
        if (norm.includes('obs') || norm.includes('nota') || norm.includes('motivo') || norm.includes('defeito') || norm.includes('manutencao') || norm.startsWith('coluna')) {
          // Verifica se tem algum texto longo nos dados
          const hasNotes = inspectRows.some(r => {
            const val = String(r[h] || '').trim();
            return val.length > 3 && !/^\d+$/.test(val);
          });
          if (hasNotes) {
            mapping.observacao = h;
          }
        }
      });
    }
  }

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
    const rawSetorRetirada = mapping.setorRetirada && row[mapping.setorRetirada] ? String(row[mapping.setorRetirada]).trim() : (row.setor_retirada || null);
    const rawValidade = mapping.validadeCalibracao ? String(row[mapping.validadeCalibracao] ?? '').trim() : '';
    const rawStatus = mapping.statusCalibracao ? String(row[mapping.statusCalibracao] ?? '').trim() : '';
    
    // Status Geral ou Legado
    const rawChecadoGeral = mapping.checadoGeral ? row[mapping.checadoGeral] : false;
    let isChecadoGeral = parseCheckValue(rawChecadoGeral);

    // FRENTE 1: CALIBRAÇÃO
    const hasCalCol = Boolean(mapping.checkCalibracao);
    const rawCheckCal = hasCalCol ? row[mapping.checkCalibracao] : null;
    let isCalChecked = hasCalCol ? parseCheckValue(rawCheckCal) : isChecadoGeral;
    
    let dataCal = mapping.dataCalibracao ? parseDateValue(row[mapping.dataCalibracao]) : null;
    if (!dataCal && isCalChecked) {
      dataCal = parseDateValue(rawCheckCal) || (mapping.dataGeral ? parseDateValue(row[mapping.dataGeral]) : null) || new Date().toISOString();
    }
    const userCal = mapping.usuarioCalibracao ? String(row[mapping.usuarioCalibracao] ?? '').trim() : (mapping.usuarioGeral ? String(row[mapping.usuarioGeral] ?? '').trim() : null);

    // FRENTE 2: PREVENTIVA
    const hasPrevCol = Boolean(mapping.checkPreventiva);
    const rawCheckPrev = hasPrevCol ? row[mapping.checkPreventiva] : null;
    let isPrevChecked = hasPrevCol ? parseCheckValue(rawCheckPrev) : false;

    let dataPrev = mapping.dataPreventiva ? parseDateValue(row[mapping.dataPreventiva]) : null;
    if (!dataPrev && isPrevChecked) {
      dataPrev = parseDateValue(rawCheckPrev) || (mapping.dataGeral ? parseDateValue(row[mapping.dataGeral]) : null) || new Date().toISOString();
    }
    const userPrev = mapping.usuarioPreventiva ? String(row[mapping.usuarioPreventiva] ?? '').trim() : (mapping.usuarioGeral ? String(row[mapping.usuarioGeral] ?? '').trim() : null);

    // FRENTE 3: SEGURANÇA ELÉTRICA
    const hasSegCol = Boolean(mapping.checkSeguranca);
    const rawCheckSeg = hasSegCol ? row[mapping.checkSeguranca] : null;
    let isSegChecked = hasSegCol ? parseCheckValue(rawCheckSeg) : false;

    let dataSeg = mapping.dataSeguranca ? parseDateValue(row[mapping.dataSeguranca]) : null;
    if (!dataSeg && isSegChecked) {
      dataSeg = parseDateValue(rawCheckSeg) || (mapping.dataGeral ? parseDateValue(row[mapping.dataGeral]) : null) || new Date().toISOString();
    }
    const userSeg = mapping.usuarioSeguranca ? String(row[mapping.usuarioSeguranca] ?? '').trim() : (mapping.usuarioGeral ? String(row[mapping.usuarioGeral] ?? '').trim() : null);

    // FRENTE 4: MANUTENÇÃO EXTERNA / TERCEIRIZADA
    const hasExtCol = Boolean(mapping.checkExterna);
    const rawCheckExt = hasExtCol ? row[mapping.checkExterna] : null;
    let isExtChecked = hasExtCol ? (parseCheckValue(rawCheckExt) || isMaintenanceExternalText(rawCheckExt)) : false;

    // Detecção inteligente em colunas de status, tipo ou observações
    if (!isExtChecked) {
      if (
        isMaintenanceExternalText(rawStatus) ||
        isMaintenanceExternalText(rawChecadoGeral) ||
        isMaintenanceExternalText(row['Status']) ||
        isMaintenanceExternalText(row['Situação']) ||
        isMaintenanceExternalText(row['Situacao']) ||
        isMaintenanceExternalText(row['Tipo']) ||
        isMaintenanceExternalText(row['Tipo Manutenção']) ||
        isMaintenanceExternalText(row['Tipo Manutencao']) ||
        isMaintenanceExternalText(row['Serviço']) ||
        isMaintenanceExternalText(row['Servico']) ||
        isMaintenanceExternalText(row['Destino']) ||
        isMaintenanceExternalText(row['Obs']) ||
        isMaintenanceExternalText(row['Observação']) ||
        isMaintenanceExternalText(row['Observacao']) ||
        isMaintenanceExternalText(row['MANUTENÇÃO']) ||
        isMaintenanceExternalText(row['Manutenção']) ||
        isMaintenanceExternalText(row['Manutencao']) ||
        isMaintenanceExternalText(row['EM MANUTENÇÃO']) ||
        isMaintenanceExternalText(row['Em Manutenção'])
      ) {
        isExtChecked = true;
      }

      // Varredura de fallback em todos os valores da linha
      if (!isExtChecked) {
        for (const [k, v] of Object.entries(row)) {
          if (isMaintenanceExternalText(v)) {
            isExtChecked = true;
            break;
          }
        }
      }
    }

    let dataExt = mapping.dataExterna ? parseDateValue(row[mapping.dataExterna]) : null;
    if (!dataExt && isExtChecked) {
      dataExt = parseDateValue(rawCheckExt) || (mapping.dataGeral ? parseDateValue(row[mapping.dataGeral]) : null) || new Date().toISOString();
    }
    const userExt = mapping.usuarioExterna 
      ? String(row[mapping.usuarioExterna] ?? '').trim() 
      : (mapping.usuarioGeral ? String(row[mapping.usuarioGeral] ?? '').trim() : 'Equipe Externa');

    const motivoExt = mapping.motivoExterna && row[mapping.motivoExterna]
      ? String(row[mapping.motivoExterna]).trim()
      : 'Calibração e conserto por equipe externa terceirizada';

    // Detecção inteligente de gatilhos específicos ("Prev", "tse", "calibrado")
    const triggerSource = rawChecadoGeral || rawStatus || row['Status'] || row['Situação'] || row['Situacao'] || row['Serviço'] || row['Servico'] || row['ESTADO - Pendente'];

    const isPrevTrigger = isPrevOnlyText(triggerSource);
    const isTseTrigger = isTseOnlyText(triggerSource);
    const isCalTrigger = isCalibradoText(triggerSource);

    if (!hasPrevCol && isPrevTrigger && !isCalTrigger && !isTseTrigger) {
      // Gatilho 'Prev': O usuário indicou expressamente somente preventiva!
      isPrevChecked = true;
      isCalChecked = false;
      isSegChecked = false;
      if (!dataPrev) dataPrev = parseDateValue(triggerSource) || new Date().toISOString();
    } else if (!hasSegCol && isTseTrigger && !isCalTrigger && !isPrevTrigger) {
      // Gatilho 'tse': O usuário indicou expressamente somente teste de segurança!
      isSegChecked = true;
      isCalChecked = false;
      isPrevChecked = false;
      if (!dataSeg) dataSeg = parseDateValue(triggerSource) || new Date().toISOString();
    } else if (!hasCalCol && isCalTrigger) {
      // Gatilho 'calibrado': Calibração metrológica padrão
      isCalChecked = true;
      if (!dataCal) dataCal = parseDateValue(triggerSource) || new Date().toISOString();
    }

    // Se estiver em Manutenção, não pode constar como calibração, preventiva ou segurança interna
    if (isExtChecked) {
      isCalChecked = false;
      isPrevChecked = false;
      isSegChecked = false;
      isChecadoGeral = false;
    }

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

    const isGlobalChecked = Boolean(isCalChecked || isPrevChecked || isSegChecked || isExtChecked || isChecadoGeral);

    return {
      id: uniqueId,
      codigoBarras: finalBarcode,
      tag: finalTag,
      equipamento: resolvedEquip,
      fabricante: rawFabricante,
      modelo: rawModelo,
      serie: rawSerie,
      setor: rawSetor,
      setor_retirada: rawSetorRetirada,
      data_retirada: row.data_retirada || (rawSetorRetirada ? new Date().toISOString() : null),
      usuario_retirada: row.usuario_retirada || null,
      validadeCalibracao: rawValidade || 'N/A',
      statusCalibracao: calculatedStatus || 'Válido',
      checado: isGlobalChecked,
      dataCheck: dataCal || dataPrev || dataSeg || dataExt || (isGlobalChecked ? new Date().toISOString() : null),
      observacao: rawObs,
      
      // Suporte multiequipes (Calibração, Preventiva, Segurança Elétrica, Manutenção Externa)
      check_calibracao: Boolean(isCalChecked),
      data_calibracao: isCalChecked ? (dataCal || new Date().toISOString()) : null,
      usuario_calibracao: isCalChecked ? (userCal || 'Planilha Original') : null,
      
      check_preventiva: Boolean(isPrevChecked),
      data_preventiva: isPrevChecked ? (dataPrev || new Date().toISOString()) : null,
      usuario_preventiva: isPrevChecked ? (userPrev || 'Planilha Original') : null,

      check_seguranca: Boolean(isSegChecked),
      data_seguranca: isSegChecked ? (dataSeg || new Date().toISOString()) : null,
      usuario_seguranca: isSegChecked ? (userSeg || 'Planilha Original') : null,

      check_externa: Boolean(isExtChecked),
      data_externa: isExtChecked ? (dataExt || new Date().toISOString()) : null,
      usuario_externa: isExtChecked ? (userExt || 'Equipe Externa') : null,
      motivo_externa: isExtChecked ? motivoExt : null,

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
  const prevHeaderRow = bestHeaderRowIndex > 0 ? (rawMatrix[bestHeaderRowIndex - 1] || []) : [];
  const maxCols = Math.max(rawHeaderRow.length, prevHeaderRow.length);

  const headers = [];
  for (let colIdx = 0; colIdx < maxCols; colIdx++) {
    const curVal = String(rawHeaderRow[colIdx] || '').trim();
    const prevVal = String(prevHeaderRow[colIdx] || '').trim();
    const isPrevBanner = prevVal.toLowerCase().includes('listagem') || 
                         prevVal.toLowerCase().includes('relatorio') || 
                         prevVal.toLowerCase().includes('planilha') ||
                         prevVal.toLowerCase().includes('inventario');

    let resolvedHeader = '';
    if (!curVal && prevVal && !isPrevBanner) {
      resolvedHeader = prevVal;
    } else if (curVal && prevVal && curVal.toLowerCase() !== prevVal.toLowerCase() && !isPrevBanner) {
      const curLower = curVal.toLowerCase();
      // Se a linha atual tiver um status inicial (ex: "Pendente", "Ativo", "Aguardando"), preserva o rótulo da linha superior
      if (curLower === 'pendente' || curLower === 'ok' || curLower === 'check' || curLower === 'ativo' || curLower === 'em manutenção') {
        resolvedHeader = `${prevVal} - ${curVal}`;
      } else {
        resolvedHeader = curVal;
      }
    } else {
      resolvedHeader = curVal || (!isPrevBanner ? prevVal : '') || `Coluna_${colIdx + 1}`;
    }
    headers.push(resolvedHeader);
  }

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
 * Converte um buffer binário ou Uint8Array de planilha em dados estruturados
 */
export function parseWorkbookBuffer(buffer, sourceName = 'Planilha') {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true, dateNF: 'yyyy-mm-dd' });
  
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
    const mapping = identifyColumns(headers, fallbackJson);
    const normalized = normalizeRows(fallbackJson, mapping);
    return {
      fileName: sourceName,
      sheetName: workbook.SheetNames[0],
      allSheets: workbook.SheetNames,
      headers,
      mapping,
      equipments: normalized,
      total: normalized.length
    };
  }

  const mapping = identifyColumns(chosenData.headers, chosenData.rawJson);
  const normalized = normalizeRows(chosenData.rawJson, mapping);

  return {
    fileName: sourceName,
    sheetName: chosenSheetName,
    allSheets: workbook.SheetNames,
    headers: chosenData.headers,
    mapping,
    equipments: normalized,
    total: normalized.length
  };
}

/**
 * Lê arquivo Excel (.xlsx, .xls) ou CSV via FileReader (Suporta qualquer arquivo cru ou semi-tratado)
 */
export async function parseSpreadsheetFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const result = parseWorkbookBuffer(data, file.name);
        resolve(result);
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

  const mapping = identifyColumns(headers, rawJson);
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
 * Exporta os dados atuais para um arquivo .xlsx baixável com suporte completo a multiequipes,
 * cabeçalhos executivos e cores dinâmicas dos setores e status.
 */
export function exportToExcel(equipments, fileName = 'conferencia_multiequipes.xlsx', modality = 'geral', sectorColors = {}, hospitalName = 'Hospital') {
  exportStyledEquipmentsExcel(equipments, {
    fileName,
    modality,
    sectorColors,
    hospitalName,
    planTitle: fileName
  });
}
