import { parseSpreadsheetFile } from './sheetParser.js';

/**
 * Normaliza data em formato brasileiro (DD/MM/AAAA) ou ISO para YYYY-MM-DD
 */
export function normalizeDateToIso(str) {
  if (!str) return '';
  const clean = String(str).trim();
  const brMatch = clean.match(/^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{2,4})/);
  if (brMatch) {
    const day = brMatch[1].padStart(2, '0');
    const month = brMatch[2].padStart(2, '0');
    let year = brMatch[3];
    if (year.length === 2) year = '20' + year;
    return `${year}-${month}-${day}`;
  }
  const isoMatch = clean.match(/^(\d{4})[\/\.-](\d{1,2})[\/\.-](\d{1,2})/);
  if (isoMatch) {
    const year = isoMatch[1];
    const month = isoMatch[2].padStart(2, '0');
    const day = isoMatch[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return '';
}

/**
 * Calcula a data de próxima calibração somando N meses
 */
export function calculateNextCalibration(dateStr, months = 12) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return '';
    d.setMonth(d.getMonth() + parseInt(months, 10));
    return d.toISOString().split('T')[0];
  } catch (e) {
    return '';
  }
}

/**
 * Determina o status de calibração baseado na data de validade
 */
export function computeCalibrationStatus(validadeStr) {
  if (!validadeStr) return 'Válido';
  try {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const target = new Date(validadeStr + 'T00:00:00');
    if (isNaN(target.getTime())) return 'Válido';
    const diffDays = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return 'Vencido';
    if (diffDays <= 30) return 'A Vencer';
    return 'Válido';
  } catch (e) {
    return 'Válido';
  }
}

/**
 * Analisador inteligente de equipamentos a partir do texto extraído de arquivos PDF
 * Suporta Laudos/Certificados individuais, múltiplos certificados e tabelas de inventário.
 */
export function parseEquipmentsFromPdf(fullText = '', lines = [], defaultSetor = 'Geral') {
  if (!fullText && (!lines || lines.length === 0)) return [];

  const rawLines = lines && lines.length > 0 
    ? lines 
    : fullText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  const equipments = [];
  const today = new Date().toISOString().split('T')[0];

  const addEquipment = (item) => {
    const tag = String(item.tag || '').trim();
    const serie = String(item.serie || '').trim();
    const codigoBarras = String(item.codigoBarras || serie || tag || '').trim();
    const eqNome = String(item.equipamento || item.nome || '').trim();

    // Precisa ter pelo menos algum identificador ou nome
    if (!tag && !serie && !codigoBarras && (!eqNome || eqNome.toLowerCase() === 'equipamento')) {
      return;
    }

    const finalBarcode = codigoBarras || serie || tag || `PDF-${Date.now().toString(36)}-${equipments.length + 1}`;
    const dataCal = normalizeDateToIso(item.dataCalibracao) || today;
    const periodicity = parseInt(item.periodicidadeMeses, 10) || 12;
    const validade = normalizeDateToIso(item.validadeCalibracao || item.proximaCalibracao) || calculateNextCalibration(dataCal, periodicity);

    // Evita duplicação exata na mesma leitura do PDF
    const isDup = equipments.some(e => 
      (serie && e.serie && e.serie.toLowerCase() === serie.toLowerCase()) ||
      (tag && e.tag && e.tag.toLowerCase() === tag.toLowerCase())
    );
    if (isDup) return;

    equipments.push({
      id: 'EQP-PDF-' + Date.now().toString(36) + '-' + equipments.length + '-' + Math.random().toString(36).substring(2, 5),
      tag: tag || finalBarcode,
      serie: serie || finalBarcode,
      codigoBarras: finalBarcode,
      equipamento: eqNome || 'Equipamento (PDF)',
      fabricante: String(item.fabricante || 'Não especificado').trim(),
      modelo: String(item.modelo || 'Padrão').trim(),
      setor: String(item.setor || defaultSetor).trim(),
      dataCalibracao: dataCal,
      periodicidadeMeses: periodicity,
      validadeCalibracao: validade,
      proximaCalibracao: validade,
      statusCalibracao: computeCalibrationStatus(validade),
      checado: false,
      observacao: String(item.observacao || 'Importado de relatório PDF').trim()
    });
  };

  // 1. ESTRATÉGIA A: Detecção de Blocos de Certificados / Laudos
  let currentBlock = null;
  const isBlockStart = (line) => {
    const l = line.toLowerCase();
    return l.includes('certificado') || l.includes('laudo') || l.includes('relatório técnico') ||
           l.includes('ordem de serviço') || l.startsWith('equipamento:') || l.startsWith('aparelho:');
  };

  rawLines.forEach((line) => {
    const l = line.trim();
    if (!l) return;

    // Detecta novo bloco de certificado
    if (isBlockStart(l) && currentBlock && (currentBlock.tag || currentBlock.serie || currentBlock.equipamento)) {
      addEquipment(currentBlock);
      currentBlock = {};
    } else if (!currentBlock && (isBlockStart(l) || l.includes(':'))) {
      currentBlock = {};
    }

    if (currentBlock) {
      // Regex aprimorados para capturar pares Chave: Valor
      const eqMatch = l.match(/(?:equipamento|aparelho|instrumento|descri[cç][aã]o)[\s:=]+([^\|\n\r;]+)/i);
      if (eqMatch) currentBlock.equipamento = eqMatch[1].trim();

      const tagMatch = l.match(/(?:tag|patrim[oô]nio|idec|c[oó]d(?:igo)?)(?:[^\w\n\r]*?)[:=#]+\s*([a-zA-Z0-9_\-\.]+)/i);
      if (tagMatch) currentBlock.tag = tagMatch[1].trim();

      const serMatch = l.match(/(?:s[eé]rie|serial|n[ºo]?\s*s[eé]rie|s\/n)[\s:=#]+([a-zA-Z0-9_\-\.\/]+)/i);
      if (serMatch) currentBlock.serie = serMatch[1].trim();

      const fabMatch = l.match(/(?:fabricante|marca)[\s:=]+([^\|\n\r;]+)/i);
      if (fabMatch) currentBlock.fabricante = fabMatch[1].trim();

      const modMatch = l.match(/(?:modelo|mod\.?)[\s:=]+([^\|\n\r;]+)/i);
      if (modMatch) currentBlock.modelo = modMatch[1].trim();

      const setMatch = l.match(/(?:setor|local(?:iza[cç][aã]o)?|departamento|unidade)[\s:=]+([^\|\n\r;]+)/i);
      if (setMatch) currentBlock.setor = setMatch[1].trim();

      const datMatch = l.match(/(?:data\s*(?:da\s*)?calibra[cç][aã]o|calibrado\s*em|execu[cç][aã]o)[\s:=]+(\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4})/i);
      if (datMatch) currentBlock.dataCalibracao = datMatch[1].trim();

      const valMatch = l.match(/(?:validade|pr[oó]xima\s*calibra[cç][aã]o|vencimento)[\s:=]+(\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4})/i);
      if (valMatch) currentBlock.validadeCalibracao = valMatch[1].trim();
    }
  });

  if (currentBlock && (currentBlock.tag || currentBlock.serie || currentBlock.equipamento)) {
    addEquipment(currentBlock);
  }

  // 2. ESTRATÉGIA B: Se não encontrou blocos chave-valor (ou encontrou poucos), tenta extração tabular
  if (equipments.length === 0) {
    let headerMap = null;

    rawLines.forEach((line) => {
      const parts = line.split(/\t|\||;|\s{2,}/).map(p => p.trim()).filter(Boolean);
      if (parts.length < 2) return;

      const cleanParts = parts.map(p => p.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim());

      // Só procura cabeçalho se ainda NÃO encontrou
      if (!headerMap) {
        const isHeader = cleanParts.some(p => 
          p === 'tag' || p === 'patrimonio' || 
          p === 'serie' || p === 'sn' || p === 'serial' ||
          p === 'equipamento' || p === 'aparelho' || p === 'descricao'
        );
        if (isHeader) {
          headerMap = { tag: -1, serie: -1, equipamento: -1, setor: -1, fabricante: -1, modelo: -1, validade: -1 };
          cleanParts.forEach((p, idx) => {
            if (p.includes('tag') || p.includes('patrimonio') || p.includes('idec')) headerMap.tag = idx;
            else if (p.includes('serie') || p.includes('serial') || p.includes('sn')) headerMap.serie = idx;
            else if (p.includes('equipamento') || p.includes('descricao') || p.includes('nome')) headerMap.equipamento = idx;
            else if (p.includes('setor') || p.includes('local') || p.includes('departamento')) headerMap.setor = idx;
            else if (p.includes('fabricante') || p.includes('marca')) headerMap.fabricante = idx;
            else if (p.includes('modelo')) headerMap.modelo = idx;
            else if (p.includes('validade') || p.includes('vencimento') || p.includes('proxima')) headerMap.validade = idx;
          });
          return;
        }
      }

      if (headerMap) {
        const item = {
          tag: headerMap.tag >= 0 ? parts[headerMap.tag] : '',
          serie: headerMap.serie >= 0 ? parts[headerMap.serie] : '',
          equipamento: headerMap.equipamento >= 0 ? parts[headerMap.equipamento] : '',
          setor: headerMap.setor >= 0 ? parts[headerMap.setor] : defaultSetor,
          fabricante: headerMap.fabricante >= 0 ? parts[headerMap.fabricante] : '',
          modelo: headerMap.modelo >= 0 ? parts[headerMap.modelo] : '',
          validadeCalibracao: headerMap.validade >= 0 ? parts[headerMap.validade] : ''
        };
        addEquipment(item);
      } else if (parts.length >= 3) {
        // Tabela sem cabeçalho explícito
        let foundDate = '';
        let foundSerial = '';
        let foundTag = '';
        let foundName = '';
        let foundSector = defaultSetor;

        parts.forEach((col) => {
          if (/\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4}/.test(col)) {
            foundDate = col;
          } else if (/^(?:sn|s\/n|ser)?-?[a-zA-Z0-9]{4,}$/i.test(col) && !col.includes(' ')) {
            if (!foundSerial) foundSerial = col;
            else if (!foundTag) foundTag = col;
          } else if (!foundName && col.length > 3) {
            foundName = col;
          } else if (!foundSector || foundSector === defaultSetor) {
            foundSector = col;
          }
        });

        if (foundSerial || foundTag || foundName) {
          addEquipment({
            tag: foundTag || foundSerial,
            serie: foundSerial || foundTag,
            equipamento: foundName || 'Equipamento',
            setor: foundSector,
            validadeCalibracao: foundDate
          });
        }
      }
    });
  }

  // 3. ESTRATÉGIA C: Fallback para Códigos e Séries avulsas no texto
  if (equipments.length === 0) {
    rawLines.forEach((line) => {
      const serialMatch = line.match(/(?:SN|S\/N|SÉRIE|SERIE)[:\s-]*([a-zA-Z0-9_-]{4,})/i);
      const tagMatch = line.match(/(?:TAG|PATRIMÔNIO|PATRIMONIO|IDEC)[:\s-]*([a-zA-Z0-9_-]{3,})/i);

      if (serialMatch || tagMatch) {
        addEquipment({
          serie: serialMatch ? serialMatch[1].trim() : '',
          tag: tagMatch ? tagMatch[1].trim() : '',
          equipamento: 'Equipamento (PDF)',
          setor: defaultSetor
        });
      }
    });
  }

  return equipments;
}

/**
 * Lê e analisa qualquer arquivo de equipamentos suportado: CSV, PDF, XLS ou XLSX
 */
export async function parseEquipmentFile(file, defaultSetor = 'Geral') {
  if (!file) throw new Error('Nenhum arquivo fornecido.');

  const fileName = file.name || 'arquivo';
  const lowerName = fileName.toLowerCase();

  // 1. Arquivo PDF
  if (lowerName.endsWith('.pdf')) {
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
            throw new Error(`Falha no servidor ao ler o arquivo PDF (Status ${res.status}).`);
          }

          const data = await res.json();
          if (!data.success) {
            throw new Error(data.message || 'Erro ao extrair texto do PDF.');
          }

          const extractedEquipments = parseEquipmentsFromPdf(data.text, data.lines, defaultSetor);

          if (extractedEquipments.length === 0) {
            throw new Error('Nenhum equipamento foi detectado no arquivo PDF. Verifique se o PDF contém texto selecionável (não apenas imagem escaneada sem OCR).');
          }

          resolve({
            success: true,
            fileName,
            fileType: 'pdf',
            total: extractedEquipments.length,
            equipments: extractedEquipments,
            rawText: data.text
          });
        } catch (err) {
          reject(err);
        }
      };

      reader.onerror = () => reject(new Error('Erro ao ler arquivo PDF do disco.'));
      reader.readAsDataURL(file);
    });
  }

  // 2. Arquivos de Planilha: XLSX, XLS ou CSV
  if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls') || lowerName.endsWith('.csv')) {
    const isCsv = lowerName.endsWith('.csv');
    const result = await parseSpreadsheetFile(file);
    return {
      success: true,
      fileName,
      fileType: isCsv ? 'csv' : 'excel',
      total: result.equipments?.length || result.total || 0,
      equipments: result.equipments || []
    };
  }

  throw new Error(`Formato de arquivo não suportado: "${fileName}". Utilize arquivos nos formatos CSV, PDF, XLS ou XLSX.`);
}

