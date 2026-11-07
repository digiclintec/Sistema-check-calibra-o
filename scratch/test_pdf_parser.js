const sampleTablePdf = `
Item | Equipamento | Tag | Série | Setor | Validade
01 | Ventilador Pulmonar | TAG-201 | SN-77112 | UTI Pediátrica | 20/08/2026
02 | Desfibrilador Cardioversor | TAG-202 | SN-77113 | Emergência | 25/09/2026
`;

function testTable(fullText) {
  const rawLines = fullText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  let headerMap = null;
  const equipments = [];

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
        setor: headerMap.setor >= 0 ? parts[headerMap.setor] : 'Geral',
        fabricante: headerMap.fabricante >= 0 ? parts[headerMap.fabricante] : '',
        modelo: headerMap.modelo >= 0 ? parts[headerMap.modelo] : '',
        validadeCalibracao: headerMap.validade >= 0 ? parts[headerMap.validade] : ''
      };
      equipments.push(item);
    }
  });

  return equipments;
}

console.log('Result:', testTable(sampleTablePdf));
