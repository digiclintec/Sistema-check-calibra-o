/**
 * Gerador de Planilhas Excel (.xlsx) Profissionais e Estilizadas com Cores
 * Suporta cores dinâmicas dos setores, status coloridos, faixas de cabeçalho e formatação executiva.
 * Compatível com Microsoft Excel, Google Sheets e LibreOffice Calc.
 */

import XLSX from 'xlsx-js-style';
import { getSectorColor, getEffectiveSector } from './sectorColors.js';

// Converte qualquer string hex (#RRGGBB ou RRGGBB) para objeto RGB puro
function hexToRgb(hex) {
  if (!hex) return { r: 100, g: 116, b: 139 };
  const clean = String(hex).replace('#', '').trim();
  if (clean.length === 3) {
    return {
      r: parseInt(clean[0] + clean[0], 16),
      g: parseInt(clean[1] + clean[1], 16),
      b: parseInt(clean[2] + clean[2], 16)
    };
  }
  if (clean.length >= 6) {
    return {
      r: parseInt(clean.substring(0, 2), 16) || 0,
      g: parseInt(clean.substring(2, 4), 16) || 0,
      b: parseInt(clean.substring(4, 6), 16) || 0
    };
  }
  return { r: 100, g: 116, b: 139 };
}

// Converte RGB numérico para string HEX sem '#' de 6 caracteres
function rgbToHex(r, g, b) {
  return [r, g, b]
    .map(x => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

/**
 * Gera paleta pastel suave para preenchimento de célula e texto de alto contraste no Excel
 */
export function getExcelSectorColors(hexColor) {
  const { r, g, b } = hexToRgb(hexColor);
  // Fundo pastel suave (~18% da cor base + 82% branco) para garantir leitura perfeita
  const bg = rgbToHex(r * 0.18 + 255 * 0.82, g * 0.18 + 255 * 0.82, b * 0.18 + 255 * 0.82);
  // Texto escuro contrastante (~68% do tom base escurecido)
  const text = rgbToHex(r * 0.68, g * 0.68, b * 0.68);
  // Borda suave
  const border = rgbToHex(r * 0.35 + 255 * 0.65, g * 0.35 + 255 * 0.65, b * 0.35 + 255 * 0.65);
  // Borda de destaque lateral viva
  const accent = rgbToHex(r, g, b);

  return { bg, text, border, accent };
}

// Estilos de bordas padrão
const THIN_BORDER = {
  top: { style: 'thin', color: { rgb: 'E2E8F0' } },
  bottom: { style: 'thin', color: { rgb: 'E2E8F0' } },
  left: { style: 'thin', color: { rgb: 'E2E8F0' } },
  right: { style: 'thin', color: { rgb: 'E2E8F0' } }
};

/**
 * Exporta a planilha principal de conferência multiequipes com cores vivas e organizadas
 */
export function exportStyledEquipmentsExcel(equipments = [], options = {}) {
  const {
    hospitalName = 'Hospital',
    planTitle = 'Conferência Geral',
    fileName = 'conferencia_multiequipes.xlsx',
    sectorColors = {}
  } = options;

  const wb = XLSX.utils.book_new();

  // Cabeçalhos da tabela
  const headerColumns = [
    { title: 'Ordem', wch: 8, align: 'center', group: 'base' },
    { title: 'Código de Barras', wch: 18, align: 'center', group: 'base' },
    { title: 'Tag / IDEC', wch: 16, align: 'center', group: 'base' },
    { title: 'Equipamento', wch: 34, align: 'left', group: 'base' },
    { title: 'Fabricante', wch: 16, align: 'left', group: 'base' },
    { title: 'Modelo', wch: 16, align: 'left', group: 'base' },
    { title: 'Nº de Série', wch: 18, align: 'center', group: 'base' },
    
    // Setores e Coleta (DESTAQUE COLORIDO)
    { title: '📍 Setor Efetivo (Cor Coleta)', wch: 28, align: 'center', group: 'sector' },
    { title: '🏢 Setor Cadastrado', wch: 22, align: 'center', group: 'sector' },
    { title: '📍 Setor Retirada', wch: 22, align: 'center', group: 'sector' },
    { title: 'Movimentado de Setor?', wch: 26, align: 'center', group: 'sector' },
    { title: 'Data da Retirada', wch: 20, align: 'center', group: 'sector' },
    { title: 'Técnico Coleta', wch: 22, align: 'left', group: 'sector' },
    { title: 'Validade Calibração', wch: 18, align: 'center', group: 'base' },
    { title: 'Status Validade', wch: 18, align: 'center', group: 'base' },
    
    // Frente 1: Calibração
    { title: 'CALIBRAÇÃO - Status', wch: 20, align: 'center', group: 'cal' },
    { title: 'CALIBRAÇÃO - Data/Hora', wch: 22, align: 'center', group: 'cal' },
    { title: 'CALIBRAÇÃO - Responsável', wch: 26, align: 'left', group: 'cal' },
    
    // Frente 2: Preventiva
    { title: 'PREVENTIVA - Status', wch: 20, align: 'center', group: 'prev' },
    { title: 'PREVENTIVA - Data/Hora', wch: 22, align: 'center', group: 'prev' },
    { title: 'PREVENTIVA - Responsável', wch: 26, align: 'left', group: 'prev' },
    
    // Frente 3: Seg. Elétrica
    { title: 'SEG. ELÉTRICA - Status', wch: 20, align: 'center', group: 'seg' },
    { title: 'SEG. ELÉTRICA - Data/Hora', wch: 22, align: 'center', group: 'seg' },
    { title: 'SEG. ELÉTRICA - Responsável', wch: 26, align: 'left', group: 'seg' },
    
    // Frente 4: Manutenção Externa (Terceirizada)
    { title: 'MANUT. EXTERNA - Status', wch: 24, align: 'center', group: 'ext' },
    { title: 'MANUT. EXTERNA - Data/Envio', wch: 22, align: 'center', group: 'ext' },
    { title: 'MANUT. EXTERNA - Responsável', wch: 26, align: 'left', group: 'ext' },

    // Status Geral Unificado
    { title: 'STATUS GERAL', wch: 32, align: 'center', group: 'geral' },
    { title: 'Observações', wch: 32, align: 'left', group: 'base' }
  ];

  const totalCols = headerColumns.length;
  const nowStr = new Date().toLocaleString('pt-BR');

  // Matriz de dados vazia para preencher célula por célula
  const aoa = [
    // Linha 0: Banner Título
    [`CALIBRACHECK • ${hospitalName.toUpperCase()} — CONFERÊNCIA MULTIEQUIPES`],
    // Linha 1: Faixa de Metadados e Legenda de Cores
    [`📅 Gerado em: ${nowStr} | 📋 Arquivo: ${planTitle} | 📍 As cores na coluna "Setor Efetivo" identificam exatamente onde o equipamento foi recolhido.`],
    // Linha 2: Espaçador
    [],
    // Linha 3: Cabeçalhos da tabela
    headerColumns.map(c => c.title)
  ];

  // Preenche dados linha a linha
  equipments.forEach((item, idx) => {
    const isExtOk = Boolean(item.check_externa);
    const isCalOk = Boolean(item.check_calibracao !== undefined ? item.check_calibracao : item.checado);
    const isPrevOk = Boolean(item.check_preventiva);
    const isSegOk = Boolean(item.check_seguranca);

    let statusGeral = 'PENDENTE';
    if (isExtOk) {
      statusGeral = '📦 MANUTENÇÃO EXTERNA (TERCEIRIZADA)';
    } else if (isCalOk && isPrevOk && isSegOk) {
      statusGeral = '100% CONCLUÍDO (3 Frentes)';
    } else if (isCalOk || isPrevOk || isSegOk) {
      const feitas = [];
      if (isCalOk) feitas.push('Calibração');
      if (isPrevOk) feitas.push('Preventiva');
      if (isSegOk) feitas.push('Segurança');
      statusGeral = `PARCIAL (${feitas.join(' + ')})`;
    }

    const effectiveSector = getEffectiveSector(item);
    const isMoved = item.setor_retirada && item.setor && 
      item.setor_retirada.trim().toLowerCase() !== item.setor.trim().toLowerCase();

    const calDate = item.data_calibracao ? new Date(item.data_calibracao).toLocaleString('pt-BR') : (isCalOk && item.dataCheck ? new Date(item.dataCheck).toLocaleString('pt-BR') : '');
    const prevDate = item.data_preventiva ? new Date(item.data_preventiva).toLocaleString('pt-BR') : '';
    const segDate = item.data_seguranca ? new Date(item.data_seguranca).toLocaleString('pt-BR') : '';
    const extDate = item.data_externa ? new Date(item.data_externa).toLocaleString('pt-BR') : '';
    const retDate = item.data_retirada ? new Date(item.data_retirada).toLocaleString('pt-BR') : '';

    const obsText = isExtOk 
      ? `Manutenção e calibração por terceirizados. ${item.motivo_externa || ''}`.trim()
      : (item.observacao || '');

    aoa.push([
      idx + 1,
      item.codigoBarras || '',
      item.tag || '',
      item.equipamento || item.nome || '',
      item.fabricante || '',
      item.modelo || '',
      item.serie || '',
      effectiveSector,
      item.setor || '',
      item.setor_retirada || item.setor || '',
      isMoved ? `⚠️ SIM (Recolhido em ${item.setor_retirada})` : 'NÃO',
      retDate,
      item.usuario_retirada || '',
      item.validadeCalibracao || '',
      item.statusCalibracao || '',
      isCalOk ? 'CONFERIDO / OK' : (isExtOk ? 'TERCEIRIZADA' : 'PENDENTE'),
      calDate,
      item.usuario_calibracao || (isCalOk ? item.conferidoPor : '') || '',
      isPrevOk ? 'CONFERIDO / OK' : 'PENDENTE',
      prevDate,
      item.usuario_preventiva || '',
      isSegOk ? 'CONFERIDO / OK' : 'PENDENTE',
      segDate,
      item.usuario_seguranca || '',
      isExtOk ? 'ENVIADA / TERCEIRIZADA' : 'NÃO ENVIADA',
      extDate,
      item.usuario_externa || '',
      statusGeral,
      obsText
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Mesclagens do Banner Superior
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: totalCols - 1 } }
  ];

  // Alturas de Linha
  ws['!rows'] = [
    { hpt: 32 }, // Banner Título
    { hpt: 20 }, // Metadados
    { hpt: 10 }, // Espaçador
    { hpt: 28 }  // Cabeçalho da Tabela
  ];

  // Larguras de Colunas
  ws['!cols'] = headerColumns.map(c => ({ wch: c.wch }));

  // Formatação do Banner Título (Linha 0)
  for (let c = 0; c < totalCols; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    if (!ws[addr]) ws[addr] = { t: 's', v: '' };
    ws[addr].s = {
      fill: { patternType: 'solid', fgColor: { rgb: '0F172A' } }, // Slate 900
      font: { name: 'Segoe UI', sz: 14, bold: true, color: { rgb: 'FFFFFF' } },
      alignment: { vertical: 'center', horizontal: 'center' }
    };
  }

  // Formatação da Faixa de Metadados (Linha 1)
  for (let c = 0; c < totalCols; c++) {
    const addr = XLSX.utils.encode_cell({ r: 1, c });
    if (!ws[addr]) ws[addr] = { t: 's', v: '' };
    ws[addr].s = {
      fill: { patternType: 'solid', fgColor: { rgb: '1E293B' } }, // Slate 800
      font: { name: 'Segoe UI', sz: 9, bold: false, color: { rgb: '94A3B8' } },
      alignment: { vertical: 'center', horizontal: 'center' }
    };
  }

  // Cores dos Cabeçalhos por Grupo de Coluna (Linha 3)
  const GROUP_STYLES = {
    base: { fillHex: '1E293B', fontHex: 'FFFFFF', borderBottom: '3B82F6' },
    sector: { fillHex: 'C2410C', fontHex: 'FFFFFF', borderBottom: 'F97316' },  // Destaque Laranja Coleta
    cal: { fillHex: '1E40AF', fontHex: 'FFFFFF', borderBottom: '60A5FA' },     // Azul Calibração
    prev: { fillHex: '065F46', fontHex: 'FFFFFF', borderBottom: '34D399' },    // Verde Preventiva
    seg: { fillHex: '5B21B6', fontHex: 'FFFFFF', borderBottom: 'A78BFA' },     // Roxo Seg. Elétrica
    ext: { fillHex: '6B21A8', fontHex: 'FFFFFF', borderBottom: 'C084FC' },     // Roxo Manut. Externa
    geral: { fillHex: '0F172A', fontHex: 'FFFFFF', borderBottom: '10B981' }    // Emerald Status Geral
  };

  headerColumns.forEach((col, c) => {
    const addr = XLSX.utils.encode_cell({ r: 3, c });
    const gStyle = GROUP_STYLES[col.group] || GROUP_STYLES.base;
    if (ws[addr]) {
      ws[addr].s = {
        fill: { patternType: 'solid', fgColor: { rgb: gStyle.fillHex } },
        font: { name: 'Segoe UI', sz: 10, bold: true, color: { rgb: gStyle.fontHex } },
        alignment: { vertical: 'center', horizontal: 'center', wrapText: true },
        border: {
          top: { style: 'thin', color: { rgb: '0F172A' } },
          bottom: { style: 'medium', color: { rgb: gStyle.borderBottom } },
          left: { style: 'thin', color: { rgb: '334155' } },
          right: { style: 'thin', color: { rgb: '334155' } }
        }
      };
    }
  });

  // Estilização das Linhas de Dados (Linha 4 em diante)
  equipments.forEach((item, idx) => {
    const r = 4 + idx;
    const isEven = idx % 2 === 0;
    const rowBg = isEven ? 'FFFFFF' : 'F8FAFC'; // Zebra striping sutil

    const effectiveSector = getEffectiveSector(item);
    const sectorColorInfo = getSectorColor(effectiveSector, sectorColors);
    const excelSector = getExcelSectorColors(sectorColorInfo.hex);

    const isCalOk = Boolean(item.check_calibracao !== undefined ? item.check_calibracao : item.checado);
    const isPrevOk = Boolean(item.check_preventiva);
    const isSegOk = Boolean(item.check_seguranca);
    const isMoved = item.setor_retirada && item.setor && 
      item.setor_retirada.trim().toLowerCase() !== item.setor.trim().toLowerCase();

    headerColumns.forEach((col, c) => {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr];
      if (!cell) return;

      // Estilo Base da Célula
      const baseCellStyle = {
        fill: { patternType: 'solid', fgColor: { rgb: rowBg } },
        font: { name: 'Segoe UI', sz: 10, color: { rgb: '334155' } },
        alignment: { vertical: 'center', horizontal: col.align },
        border: THIN_BORDER
      };

      // 1. Coluna Especial: SETOR EFETIVO (COR DA COLETA)
      if (col.title.includes('Setor Efetivo')) {
        cell.s = {
          fill: { patternType: 'solid', fgColor: { rgb: excelSector.bg } },
          font: { name: 'Segoe UI', sz: 10, bold: true, color: { rgb: excelSector.text } },
          alignment: { vertical: 'center', horizontal: 'center' },
          border: {
            top: { style: 'thin', color: { rgb: excelSector.border } },
            bottom: { style: 'thin', color: { rgb: excelSector.border } },
            left: { style: 'medium', color: { rgb: excelSector.accent } }, // Tarja lateral na cor do setor!
            right: { style: 'thin', color: { rgb: excelSector.border } }
          }
        };
        return;
      }

      // 2. Coluna Especial: MOVIMENTADO DE SETOR?
      if (col.title.includes('Movimentado de Setor')) {
        if (isMoved) {
          cell.s = {
            fill: { patternType: 'solid', fgColor: { rgb: 'FEF3C7' } }, // Âmbar claro
            font: { name: 'Segoe UI', sz: 9, bold: true, color: { rgb: 'B45309' } },
            alignment: { vertical: 'center', horizontal: 'center' },
            border: {
              top: { style: 'thin', color: { rgb: 'FCD34D' } },
              bottom: { style: 'thin', color: { rgb: 'FCD34D' } },
              left: { style: 'thin', color: { rgb: 'FCD34D' } },
              right: { style: 'thin', color: { rgb: 'FCD34D' } }
            }
          };
        } else {
          cell.s = {
            ...baseCellStyle,
            font: { name: 'Segoe UI', sz: 9, color: { rgb: '94A3B8' } },
            alignment: { vertical: 'center', horizontal: 'center' }
          };
        }
        return;
      }

      // 3. Colunas de Status das Frentes (Calibração, Preventiva, Seg. Elétrica, Manut. Externa)
      if (col.title.endsWith('- Status')) {
        const val = String(cell.v || '');
        if (val.includes('CONFERIDO') || val.includes('OK')) {
          cell.s = {
            fill: { patternType: 'solid', fgColor: { rgb: 'DCFCE7' } }, // Verde claro
            font: { name: 'Segoe UI', sz: 10, bold: true, color: { rgb: '15803D' } },
            alignment: { vertical: 'center', horizontal: 'center' },
            border: {
              top: { style: 'thin', color: { rgb: '86EFAC' } },
              bottom: { style: 'thin', color: { rgb: '86EFAC' } },
              left: { style: 'thin', color: { rgb: '86EFAC' } },
              right: { style: 'thin', color: { rgb: '86EFAC' } }
            }
          };
        } else if (val.includes('ENVIADA') || val.includes('TERCEIRIZADA')) {
          cell.s = {
            fill: { patternType: 'solid', fgColor: { rgb: 'F3E8FF' } }, // Roxo pastel
            font: { name: 'Segoe UI', sz: 10, bold: true, color: { rgb: '6B21A8' } },
            alignment: { vertical: 'center', horizontal: 'center' },
            border: {
              top: { style: 'thin', color: { rgb: 'D8B4FE' } },
              bottom: { style: 'thin', color: { rgb: 'D8B4FE' } },
              left: { style: 'thin', color: { rgb: 'D8B4FE' } },
              right: { style: 'thin', color: { rgb: 'D8B4FE' } }
            }
          };
        } else {
          cell.s = {
            fill: { patternType: 'solid', fgColor: { rgb: 'FEE2E2' } }, // Vermelho suave
            font: { name: 'Segoe UI', sz: 10, bold: true, color: { rgb: 'B91C1C' } },
            alignment: { vertical: 'center', horizontal: 'center' },
            border: {
              top: { style: 'thin', color: { rgb: 'FCA5A5' } },
              bottom: { style: 'thin', color: { rgb: 'FCA5A5' } },
              left: { style: 'thin', color: { rgb: 'FCA5A5' } },
              right: { style: 'thin', color: { rgb: 'FCA5A5' } }
            }
          };
        }
        return;
      }

      // 4. Coluna STATUS GERAL
      if (col.title === 'STATUS GERAL') {
        const val = String(cell.v || '');
        if (val.includes('MANUTENÇÃO EXTERNA')) {
          cell.s = {
            fill: { patternType: 'solid', fgColor: { rgb: '9333EA' } }, // Roxo vibrante
            font: { name: 'Segoe UI', sz: 10, bold: true, color: { rgb: 'FFFFFF' } },
            alignment: { vertical: 'center', horizontal: 'center' },
            border: THIN_BORDER
          };
        } else if (val.includes('100% CONCLUÍDO')) {
          cell.s = {
            fill: { patternType: 'solid', fgColor: { rgb: '10B981' } }, // Emerald sólido
            font: { name: 'Segoe UI', sz: 10, bold: true, color: { rgb: 'FFFFFF' } },
            alignment: { vertical: 'center', horizontal: 'center' },
            border: THIN_BORDER
          };
        } else if (val.includes('PARCIAL')) {
          cell.s = {
            fill: { patternType: 'solid', fgColor: { rgb: 'FEF3C7' } }, // Âmbar suave
            font: { name: 'Segoe UI', sz: 10, bold: true, color: { rgb: 'B45309' } },
            alignment: { vertical: 'center', horizontal: 'center' },
            border: THIN_BORDER
          };
        } else {
          cell.s = {
            fill: { patternType: 'solid', fgColor: { rgb: 'FEE2E2' } }, // Vermelho suave
            font: { name: 'Segoe UI', sz: 10, bold: true, color: { rgb: 'B91C1C' } },
            alignment: { vertical: 'center', horizontal: 'center' },
            border: THIN_BORDER
          };
        }
        return;
      }

      // 5. Células de Dados Comuns
      cell.s = baseCellStyle;
      if (col.title === 'Equipamento' || col.title === 'Tag / IDEC') {
        cell.s.font = { name: 'Segoe UI', sz: 10, bold: true, color: { rgb: '0F172A' } };
      }
    });
  });

  XLSX.utils.book_append_sheet(wb, ws, 'Conferência Hospitalar');
  XLSX.writeFile(wb, fileName);
}

/**
 * Exporta o Espelho de Ponto dos Técnicos com setores coloridos e resumo executivo
 */
export function exportStyledPontoExcel(pontoEntries = [], options = {}) {
  const {
    hospitalName = 'Hospital',
    fileName = 'Espelho_de_Ponto.xlsx',
    sectorColors = {}
  } = options;

  const wb = XLSX.utils.book_new();

  // ---------------- ABA 1: REGISTRO CRONOLÓGICO DE PONTO ----------------
  const headerColumns = [
    { title: 'Item', wch: 8, align: 'center' },
    { title: '📅 Data', wch: 14, align: 'center' },
    { title: '⏰ Horário', wch: 12, align: 'center' },
    { title: '👤 Técnico / Inspetor', wch: 28, align: 'left' },
    { title: '🛠️ Serviço Realizado', wch: 22, align: 'center' },
    { title: '📦 Equipamento', wch: 32, align: 'left' },
    { title: '🏷️ Tag / IDEC', wch: 16, align: 'center' },
    { title: '🔢 Nº de Série', wch: 18, align: 'center' },
    { title: '📍 Setor de Retirada (Coleta)', wch: 26, align: 'center' },
    { title: '🏢 Setor Original', wch: 22, align: 'center' },
    { title: '📝 Observações', wch: 25, align: 'left' }
  ];

  const totalCols = headerColumns.length;
  const nowStr = new Date().toLocaleString('pt-BR');

  const aoa = [
    [`CALIBRACHECK • ESPELHO DE PONTO & AUDITORIA DA EQUIPE — ${hospitalName.toUpperCase()}`],
    [`📅 Gerado em: ${nowStr} | Total de Ações Registradas: ${pontoEntries.length} | Setores coloridos indicam o local de recolhimento`],
    [],
    headerColumns.map(c => c.title)
  ];

  pontoEntries.forEach((entry, idx) => {
    const d = entry.date ? new Date(entry.date) : null;
    aoa.push([
      idx + 1,
      d ? d.toLocaleDateString('pt-BR') : 'N/A',
      d ? d.toLocaleTimeString('pt-BR') : 'N/A',
      entry.user || 'Técnico',
      entry.modalityLabel || entry.modality || '',
      entry.equipmentName || '',
      entry.tag || '',
      entry.serie || '',
      entry.setorRetirada || 'Geral',
      entry.setorOriginal || 'Geral',
      entry.obs || ''
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: totalCols - 1 } }
  ];
  ws['!rows'] = [{ hpt: 30 }, { hpt: 20 }, { hpt: 10 }, { hpt: 26 }];
  ws['!cols'] = headerColumns.map(c => ({ wch: c.wch }));

  // Formata Banner
  for (let c = 0; c < totalCols; c++) {
    const a1 = XLSX.utils.encode_cell({ r: 0, c });
    if (!ws[a1]) ws[a1] = { t: 's', v: '' };
    ws[a1].s = {
      fill: { patternType: 'solid', fgColor: { rgb: '0F172A' } },
      font: { name: 'Segoe UI', sz: 13, bold: true, color: { rgb: 'FFFFFF' } },
      alignment: { vertical: 'center', horizontal: 'center' }
    };

    const a2 = XLSX.utils.encode_cell({ r: 1, c });
    if (!ws[a2]) ws[a2] = { t: 's', v: '' };
    ws[a2].s = {
      fill: { patternType: 'solid', fgColor: { rgb: '1E293B' } },
      font: { name: 'Segoe UI', sz: 9, color: { rgb: '94A3B8' } },
      alignment: { vertical: 'center', horizontal: 'center' }
    };

    const aH = XLSX.utils.encode_cell({ r: 3, c });
    if (ws[aH]) {
      ws[aH].s = {
        fill: { patternType: 'solid', fgColor: { rgb: '1E293B' } },
        font: { name: 'Segoe UI', sz: 10, bold: true, color: { rgb: 'FFFFFF' } },
        alignment: { vertical: 'center', horizontal: 'center' },
        border: {
          top: { style: 'thin', color: { rgb: '0F172A' } },
          bottom: { style: 'medium', color: { rgb: '3B82F6' } },
          left: { style: 'thin', color: { rgb: '334155' } },
          right: { style: 'thin', color: { rgb: '334155' } }
        }
      };
    }
  }

  // Estilização das Linhas de Ponto
  pontoEntries.forEach((entry, idx) => {
    const r = 4 + idx;
    const isEven = idx % 2 === 0;
    const rowBg = isEven ? 'FFFFFF' : 'F8FAFC';

    const sColorInfo = getSectorColor(entry.setorRetirada, sectorColors);
    const excelSector = getExcelSectorColors(sColorInfo.hex);

    headerColumns.forEach((col, c) => {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr];
      if (!cell) return;

      const baseCellStyle = {
        fill: { patternType: 'solid', fgColor: { rgb: rowBg } },
        font: { name: 'Segoe UI', sz: 10, color: { rgb: '334155' } },
        alignment: { vertical: 'center', horizontal: col.align },
        border: THIN_BORDER
      };

      // Setor de Retirada Colorido
      if (col.title.includes('Setor de Retirada')) {
        cell.s = {
          fill: { patternType: 'solid', fgColor: { rgb: excelSector.bg } },
          font: { name: 'Segoe UI', sz: 10, bold: true, color: { rgb: excelSector.text } },
          alignment: { vertical: 'center', horizontal: 'center' },
          border: {
            top: { style: 'thin', color: { rgb: excelSector.border } },
            bottom: { style: 'thin', color: { rgb: excelSector.border } },
            left: { style: 'medium', color: { rgb: excelSector.accent } },
            right: { style: 'thin', color: { rgb: excelSector.border } }
          }
        };
        return;
      }

      // Serviço Badge
      if (col.title.includes('Serviço Realizado')) {
        const val = String(cell.v || '').toLowerCase();
        let sBg = 'EFF6FF', sText = '1D4ED8';
        if (val.includes('prev')) {
          sBg = 'ECFDF5'; sText = '047857';
        } else if (val.includes('seg') || val.includes('tse')) {
          sBg = 'F5F3FF'; sText = '6D28D9';
        }
        cell.s = {
          fill: { patternType: 'solid', fgColor: { rgb: sBg } },
          font: { name: 'Segoe UI', sz: 9, bold: true, color: { rgb: sText } },
          alignment: { vertical: 'center', horizontal: 'center' },
          border: THIN_BORDER
        };
        return;
      }

      cell.s = baseCellStyle;
      if (col.title.includes('Técnico')) {
        cell.s.font = { name: 'Segoe UI', sz: 10, bold: true, color: { rgb: '0F172A' } };
      }
    });
  });

  XLSX.utils.book_append_sheet(wb, ws, 'Espelho de Ponto (Ações)');

  // ---------------- ABA 2: RESUMO EXECUTIVO POR TÉCNICO ----------------
  const techMap = new Map();
  pontoEntries.forEach(entry => {
    const user = entry.user || 'Técnico';
    if (!techMap.has(user)) {
      techMap.set(user, {
        total: 0,
        cal: 0,
        prev: 0,
        seg: 0,
        firstTime: entry.date,
        lastTime: entry.date,
        sectors: new Set()
      });
    }
    const t = techMap.get(user);
    t.total++;
    if (entry.modality === 'calibracao') t.cal++;
    if (entry.modality === 'preventiva') t.prev++;
    if (entry.modality === 'seguranca') t.seg++;
    if (entry.setorRetirada) t.sectors.add(entry.setorRetirada);
    if (entry.date < t.firstTime) t.firstTime = entry.date;
    if (entry.date > t.lastTime) t.lastTime = entry.date;
  });

  const summaryHeaders = [
    { title: 'Técnico / Inspetor', wch: 28 },
    { title: 'Total Ações', wch: 14 },
    { title: 'Calibrações', wch: 14 },
    { title: 'Preventivas', wch: 14 },
    { title: 'Seg. Elétrica', wch: 14 },
    { title: 'Início da Jornada', wch: 22 },
    { title: 'Último Registro', wch: 22 },
    { title: 'Setores Percorridos', wch: 36 }
  ];

  const summaryAoa = [
    [`RESUMO EXECUTIVO DE PRODUTIVIDADE — ${hospitalName.toUpperCase()}`],
    [`Consolidado de técnicos com horários e setores de atendimento`],
    [],
    summaryHeaders.map(h => h.title)
  ];

  Array.from(techMap.entries()).forEach(([techName, data]) => {
    const firstStr = data.firstTime ? new Date(data.firstTime).toLocaleString('pt-BR') : 'N/A';
    const lastStr = data.lastTime ? new Date(data.lastTime).toLocaleString('pt-BR') : 'N/A';
    summaryAoa.push([
      techName,
      data.total,
      data.cal,
      data.prev,
      data.seg,
      firstStr,
      lastStr,
      Array.from(data.sectors).join(', ')
    ]);
  });

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryAoa);
  wsSummary['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: summaryHeaders.length - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: summaryHeaders.length - 1 } }
  ];
  wsSummary['!rows'] = [{ hpt: 30 }, { hpt: 20 }, { hpt: 10 }, { hpt: 26 }];
  wsSummary['!cols'] = summaryHeaders.map(h => ({ wch: h.wch }));

  // Estiliza Cabeçalho da Aba 2
  for (let c = 0; c < summaryHeaders.length; c++) {
    const a1 = XLSX.utils.encode_cell({ r: 0, c });
    if (!wsSummary[a1]) wsSummary[a1] = { t: 's', v: '' };
    wsSummary[a1].s = {
      fill: { patternType: 'solid', fgColor: { rgb: '0F172A' } },
      font: { name: 'Segoe UI', sz: 13, bold: true, color: { rgb: 'FFFFFF' } },
      alignment: { vertical: 'center', horizontal: 'center' }
    };

    const a2 = XLSX.utils.encode_cell({ r: 1, c });
    if (!wsSummary[a2]) wsSummary[a2] = { t: 's', v: '' };
    wsSummary[a2].s = {
      fill: { patternType: 'solid', fgColor: { rgb: '1E293B' } },
      font: { name: 'Segoe UI', sz: 9, color: { rgb: '94A3B8' } },
      alignment: { vertical: 'center', horizontal: 'center' }
    };

    const aH = XLSX.utils.encode_cell({ r: 3, c });
    if (wsSummary[aH]) {
      wsSummary[aH].s = {
        fill: { patternType: 'solid', fgColor: { rgb: '1E293B' } },
        font: { name: 'Segoe UI', sz: 10, bold: true, color: { rgb: 'FFFFFF' } },
        alignment: { vertical: 'center', horizontal: 'center' },
        border: THIN_BORDER
      };
    }
  }

  // Estiliza Linhas da Aba 2
  Array.from(techMap.keys()).forEach((_, idx) => {
    const r = 4 + idx;
    const isEven = idx % 2 === 0;
    const rowBg = isEven ? 'FFFFFF' : 'F8FAFC';

    summaryHeaders.forEach((_, c) => {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = wsSummary[addr];
      if (!cell) return;

      cell.s = {
        fill: { patternType: 'solid', fgColor: { rgb: rowBg } },
        font: { name: 'Segoe UI', sz: 10, color: { rgb: '334155' } },
        alignment: { vertical: 'center', horizontal: c === 0 ? 'left' : 'center' },
        border: THIN_BORDER
      };
      if (c === 0) {
        cell.s.font = { name: 'Segoe UI', sz: 10, bold: true, color: { rgb: '0F172A' } };
      }
      if (c === 1) {
        cell.s.font = { name: 'Segoe UI', sz: 10, bold: true, color: { rgb: '1E40AF' } };
      }
    });
  });

  XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumo por Técnico');

  XLSX.writeFile(wb, fileName);
}
