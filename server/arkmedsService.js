/**
 * Serviço de Integração Arkmeds (Modo Consulta e Sincronização - SOMENTE LEITURA)
 * 
 * ATENÇÃO: Nenhuma alteração, exclusão ou edição é realizada no sistema Arkmeds.
 * Todas as operações são exclusivamente de leitura (GET) para consulta de QR Codes e sincronização.
 */

let cachedSessionCookie = null;
let cachedSessionExpiry = 0;
let loginInProgressPromise = null;

const BASE_URL = process.env.ARKMEDS_BASE_URL || 'https://hifaclinica.arkmeds.com';
const ARKMEDS_EMAIL = process.env.ARKMEDS_EMAIL || 'rodrigo@engemedica.com.br';
const ARKMEDS_PASSWORD = process.env.ARKMEDS_PASSWORD || 'hifa123';

/**
 * Autentica no Arkmeds e obtém sessionid ativo (com cache de 45 minutos)
 */
export async function getArkmedsSession(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedSessionCookie && cachedSessionExpiry > now) {
    return cachedSessionCookie;
  }

  // Evita múltiplas chamadas simultâneas de login
  if (loginInProgressPromise) {
    return loginInProgressPromise;
  }

  loginInProgressPromise = (async () => {
    try {
      const loginUrl = `${BASE_URL}/usuarios/conectar`;
      
      // 1. Obtém formulário de login e token CSRF
      const getRes = await fetch(loginUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (CalibraCheck-Arkmeds-Integration/1.0)'
        }
      });

      const setCookies = getRes.headers.getSetCookie 
        ? getRes.headers.getSetCookie() 
        : [getRes.headers.get('set-cookie') || ''];
      
      let csrfToken = '';
      for (const sc of setCookies) {
        const m = sc.match(/csrftoken=([^;]+)/);
        if (m) {
          csrfToken = m[1];
          break;
        }
      }

      if (!csrfToken) {
        throw new Error('Não foi possível obter o token CSRF do Arkmeds.');
      }

      // 2. Realiza POST de autenticação (somente para iniciar a sessão de consulta)
      const formParams = new URLSearchParams();
      formParams.append('csrfmiddlewaretoken', csrfToken);
      formParams.append('username', ARKMEDS_EMAIL);
      formParams.append('password', ARKMEDS_PASSWORD);

      const postRes = await fetch(loginUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cookie': `csrftoken=${csrfToken}`,
          'Referer': loginUrl,
          'User-Agent': 'Mozilla/5.0 (CalibraCheck-Arkmeds-Integration/1.0)'
        },
        body: formParams.toString(),
        redirect: 'manual'
      });

      const postCookies = postRes.headers.getSetCookie 
        ? postRes.headers.getSetCookie() 
        : [postRes.headers.get('set-cookie') || ''];

      let sessionId = '';
      for (const sc of postCookies) {
        const m = sc.match(/sessionid=([^;]+)/);
        if (m) {
          sessionId = m[1];
          break;
        }
      }

      if (!sessionId) {
        const responseBody = await postRes.text().catch(() => '');
        if (responseBody.includes('incorret')) {
          throw new Error('Credenciais do Arkmeds incorretas.');
        }
        throw new Error('Falha ao autenticar no Arkmeds (sessão não criada).');
      }

      cachedSessionCookie = `sessionid=${sessionId}; csrftoken=${csrfToken}`;
      cachedSessionExpiry = now + (45 * 60 * 1000); // 45 minutos de validade
      return cachedSessionCookie;
    } finally {
      loginInProgressPromise = null;
    }
  })();

  return loginInProgressPromise;
}

/**
 * Normaliza e resolve um QR Code da Arkmeds
 * Aceita URL completa, caminho relativo ou token numérico (ex: "001005")
 */
export async function resolveArkmedsQrCode(qrCodeInput) {
  if (!qrCodeInput) throw new Error('Código do QR Code não informado.');
  
  const raw = String(qrCodeInput).trim();
  let qrUrl = '';

  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    qrUrl = raw;
  } else if (raw.startsWith('/qr_code/')) {
    qrUrl = `${BASE_URL}${raw}`;
  } else if (/^\d+$/.test(raw)) {
    qrUrl = `${BASE_URL}/qr_code/equipamento/${raw}/`;
  } else {
    // Tenta encontrar o token dentro de string composta
    const m = raw.match(/\/qr_code\/equipamento\/([a-zA-Z0-9_\-]+)/i);
    if (m) {
      qrUrl = `${BASE_URL}/qr_code/equipamento/${m[1]}/`;
    } else {
      qrUrl = `${BASE_URL}/qr_code/equipamento/${raw}/`;
    }
  }

  // Garante barra final
  if (!qrUrl.endsWith('/')) qrUrl += '/';

  const session = await getArkmedsSession();

  // Executa GET com redirecionamento manual para obter o Location do equipamento
  const qrRes = await fetch(qrUrl, {
    method: 'GET',
    headers: {
      'Cookie': session,
      'User-Agent': 'Mozilla/5.0 (CalibraCheck-Arkmeds-Integration/1.0)'
    },
    redirect: 'manual'
  });

  const targetLocation = qrRes.headers.get('Location') || qrRes.headers.get('location');
  
  // Se redirecionou de volta para conectar, a sessão pode ter expirado; tenta renovar uma vez
  if (targetLocation && targetLocation.includes('/usuarios/conectar')) {
    const freshSession = await getArkmedsSession(true);
    const retryRes = await fetch(qrUrl, {
      method: 'GET',
      headers: {
        'Cookie': freshSession,
        'User-Agent': 'Mozilla/5.0 (CalibraCheck-Arkmeds-Integration/1.0)'
      },
      redirect: 'manual'
    });
    const retryLocation = retryRes.headers.get('Location') || retryRes.headers.get('location');
    if (!retryLocation) {
      throw new Error('QR Code não encontrado ou inválido no Arkmeds.');
    }
    return processResolvedLocation(retryLocation, freshSession, qrUrl);
  }

  if (!targetLocation) {
    throw new Error('QR Code não redirecionou para um equipamento válido no Arkmeds.');
  }

  return processResolvedLocation(targetLocation, session, qrUrl);
}

/**
 * Processa a URL de destino da ficha do equipamento no Arkmeds
 */
async function processResolvedLocation(locationUrl, session, originalQrUrl) {
  // Extrai o ID do equipamento da URL (ex: /cadastros/equipamento/visual/3538)
  const idMatch = locationUrl.match(/\/cadastros\/equipamento\/visual\/(\d+)/i);
  const arkmedsId = idMatch ? idMatch[1] : null;

  let fullVisualUrl = locationUrl.startsWith('http') ? locationUrl : `${BASE_URL}${locationUrl}`;
  if (!fullVisualUrl.endsWith('/')) fullVisualUrl += '/';

  // Consulta os detalhes da ficha (SOMENTE LEITURA)
  const visRes = await fetch(fullVisualUrl, {
    headers: {
      'Cookie': session,
      'User-Agent': 'Mozilla/5.0 (CalibraCheck-Arkmeds-Integration/1.0)'
    }
  });

  if (!visRes.ok) {
    throw new Error(`Falha ao carregar detalhes do equipamento no Arkmeds (Status ${visRes.status})`);
  }

  const html = await visRes.text();

  // Extração universal dos pares chave: valor dos blocos <p><strong>Campo: </strong>Valor</p>
  const fields = {};
  const matches = html.matchAll(/<strong[^>]*>([^<:]+):?\s*<\/strong>\s*([^<]+)</gi);
  for (const m of matches) {
    const rawKey = m[1].trim();
    const normalizedKey = rawKey.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    fields[normalizedKey] = m[2].trim();
  }

  // Extrai o título principal do equipamento (<h2 class="sub-title">Nome</h2>)
  const titleMatch = html.match(/<h[1234][^>]*class=[\"'][^\"']*sub-title[^\"']*[\"'][^>]*>([^<]+)<\/h[1234]>/i) ||
                     html.match(/<h[234][^>]*class=[\"'][^\"']*widget-header[^\"']*[\"'][^>]*>([\s\S]*?)<\/h[234]>/i);

  const rawTitle = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : '';

  const tipo = fields['tipo'] || fields['tipo de equipamento'] || '';
  const modelo = fields['modelo'] || '';
  const fabricante = fields['fabricante'] || '';
  const serie = fields['numero de serie'] || fields['serie'] || '';
  const identificacao = fields['identificacao'] || fields['tag'] || '';
  const patrimonio = fields['patrimonio'] || fields['tombamento'] || '';
  const proprietario = fields['proprietario'] || '';
  const estado = fields['estado'] || 'Ativo';
  const anvisa = fields['registro anvisa'] || fields['anvisa'] || '';
  const dataAquisicao = fields['data de aquisicao'] || '';

  // Determina o nome do equipamento de forma limpa
  let equipamentoNome = rawTitle || [tipo, fabricante, modelo].filter(Boolean).join(' ');
  if (!equipamentoNome || equipamentoNome.toLowerCase().includes('deprecia')) {
    equipamentoNome = [tipo, fabricante, modelo].filter(Boolean).join(' ') || tipo || 'Equipamento Hospitalar';
  }

  // Extrai setor e hospital a partir do Proprietário (ex: "UTI ADULTO - HOSPITAL GERAL DR. LUIZ BUAIZ")
  let setor = proprietario;
  let hospital = '';
  if (proprietario.includes(' - ')) {
    const parts = proprietario.split(' - ');
    setor = parts[0].trim();
    hospital = parts.slice(1).join(' - ').trim();
  }

  // Extrai visitas programadas (planos em que o equipamento está cadastrado)
  const visitasProgramadas = [];
  const visSectionMatch = html.match(/Visitas Programadas[\s\S]*?<table[^>]*>([\s\S]*?)<\/table>/i);
  if (visSectionMatch) {
    const rows = [...visSectionMatch[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
    for (const r of rows) {
      const cells = [...r[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(c => c[1].replace(/<[^>]+>/g, '').trim());
      if (cells.length >= 3) {
        visitasProgramadas.push({
          plano: cells[0],
          periodoPrevisto: cells[1],
          tipoServico: cells[2]
        });
      }
    }
  }

  // Extrai histórico completo de Ordens de Serviço (OS) via API dedicada do Arkmeds
  let ordensServico = [];
  if (arkmedsId) {
    try {
      const osUrl = `${BASE_URL}/cadastros/apis/os_equipamento_paginada/?draw=1&start=0&length=100&equipamento=${arkmedsId}`;
      const osRes = await fetch(osUrl, {
        headers: {
          'Cookie': session,
          'X-Requested-With': 'XMLHttpRequest',
          'Referer': fullVisualUrl,
          'User-Agent': 'Mozilla/5.0 (CalibraCheck-Arkmeds-Integration/1.0)'
        }
      });
      if (osRes.ok) {
        const osJson = await osRes.json();
        ordensServico = (osJson.data || []).map(os => ({
          id: os.id,
          numero: os.numero,
          estado: os.estado,
          tipoServico: os.tipo_servico,
          titulo: os.titulo,
          problema: os.problema,
          responsavel: os.responsavel,
          solicitante: os.solicitante,
          prioridade: os.prioridade,
          dataCriacao: os.data_criacao,
          dataConclusao: os.data_conclusao,
          pdfUrl: os.print_url ? `${BASE_URL}${os.print_url}` : null,
          visualUrl: `${BASE_URL}/ordem_servico/visual/${os.id}/`
        }));
      }
    } catch (osErr) {
      console.warn('[Arkmeds] Falha ao consultar Ordens de Serviço para equipamento', arkmedsId, osErr.message);
    }
  }

  // Destaque para a última Ordem de Serviço (a mais recente cadastrada)
  const ultimaOrdemServico = ordensServico.length > 0 ? ordensServico[0] : null;

  // Token numérico extraído do QR Code original
  const tokenMatch = originalQrUrl ? originalQrUrl.match(/\/qr_code\/equipamento\/([a-zA-Z0-9_\-]+)/i) : null;
  const qrToken = tokenMatch ? tokenMatch[1] : '';

  return {
    success: true,
    arkmedsId: arkmedsId || fields['id'] || '',
    qrCodeToken: qrToken,
    qrCodeUrl: originalQrUrl,
    visualUrl: fullVisualUrl,
    equipamento: equipamentoNome,
    tipo,
    fabricante,
    modelo,
    serie,
    tag: identificacao,
    patrimonio: patrimonio && patrimonio !== 'N/A' ? patrimonio : '',
    proprietario,
    setor,
    hospital,
    estado,
    anvisa,
    dataAquisicao,
    rawFields: fields,
    visitasProgramadas,
    ordensServico,
    ultimaOrdemServico,
    // Formato pronto para inserção no CalibraCheck
    calibraCheckPayload: {
      id: `ARK-${arkmedsId || identificacao || serie || patrimonio}`,
      arkmedsId: arkmedsId || '',
      arkmedsQrToken: qrToken,
      arkmedsQrUrl: originalQrUrl,
      codigoBarras: serie || identificacao || patrimonio || arkmedsId || qrToken,
      tag: identificacao || `TAG-${arkmedsId}`,
      patrimonio: patrimonio && patrimonio !== 'N/A' ? patrimonio : '',
      equipamento: equipamentoNome,
      fabricante,
      modelo,
      serie,
      setor: setor || 'Geral',
      validadeCalibracao: 'N/A',
      statusCalibracao: 'Válido',
      checado: false,
      dataCheck: null,
      observacao: `Importado do Arkmeds (ID: ${arkmedsId || qrToken})`,
      origem: 'arkmeds'
    }
  };
}

/**
 * Consulta Universal Completa de Equipamento no Arkmeds (SOMENTE LEITURA)
 * Pesquisa em todos os hospitais e setores por QR Code, ID Arkmeds, Tag, Número de Série ou termo livre.
 */
export async function searchArkmedsEquipmentUniversal(searchTerm) {
  if (!searchTerm) throw new Error('Termo de busca não informado.');
  const query = String(searchTerm).trim();
  const session = await getArkmedsSession();

  // 1. Se for URL de QR code ou caminho
  if (query.includes('/qr_code/') || query.startsWith('http://') || query.startsWith('https://')) {
    return resolveArkmedsQrCode(query);
  }

  // 2. Se for número puro (pode ser QR Token como 001005 ou ID Arkmeds como 3538)
  if (/^\d+$/.test(query)) {
    // Tenta primeiro como QR Code token
    try {
      const qrRes = await fetch(`${BASE_URL}/qr_code/equipamento/${query}/`, {
        headers: { 
          'Cookie': session,
          'User-Agent': 'Mozilla/5.0 (CalibraCheck-Arkmeds-Integration/1.0)'
        },
        redirect: 'manual'
      });
      const loc = qrRes.headers.get('Location') || qrRes.headers.get('location');
      if (loc && loc.includes('/visual/')) {
        return processResolvedLocation(loc, session, `${BASE_URL}/qr_code/equipamento/${query}/`);
      }
    } catch {}

    // Tenta diretamente como ID visual
    try {
      const visRes = await fetch(`${BASE_URL}/cadastros/equipamento/visual/${query}/`, {
        headers: { 
          'Cookie': session,
          'User-Agent': 'Mozilla/5.0 (CalibraCheck-Arkmeds-Integration/1.0)'
        }
      });
      if (visRes.ok) {
        return processResolvedLocation(`/cadastros/equipamento/visual/${query}/`, session, '');
      }
    } catch {}
  }

  // 3. Busca por identificacao / tag
  try {
    const tagRes = await fetch(`${BASE_URL}/cadastros/equipamento/?identificacao=${encodeURIComponent(query)}`, {
      headers: { 
        'Cookie': session,
        'User-Agent': 'Mozilla/5.0 (CalibraCheck-Arkmeds-Integration/1.0)'
      }
    });
    const tagHtml = await tagRes.text();
    let m = tagHtml.match(/href=[\"\']visual\/(\d+)\/[\"\']/i) || tagHtml.match(/\/cadastros\/equipamento\/visual\/(\d+)\//i);
    if (m) {
      return processResolvedLocation(`/cadastros/equipamento/visual/${m[1]}/`, session, '');
    }
  } catch {}

  // 4. Busca por numero_serie
  try {
    const serieRes = await fetch(`${BASE_URL}/cadastros/equipamento/?numero_serie=${encodeURIComponent(query)}`, {
      headers: { 
        'Cookie': session,
        'User-Agent': 'Mozilla/5.0 (CalibraCheck-Arkmeds-Integration/1.0)'
      }
    });
    const serieHtml = await serieRes.text();
    let m = serieHtml.match(/href=[\"\']visual\/(\d+)\/[\"\']/i) || serieHtml.match(/\/cadastros\/equipamento\/visual\/(\d+)\//i);
    if (m) {
      return processResolvedLocation(`/cadastros/equipamento/visual/${m[1]}/`, session, '');
    }
  } catch {}

  // 4b. Busca por patrimonio / tombamento
  try {
    const patRes = await fetch(`${BASE_URL}/cadastros/equipamento/?patrimonio=${encodeURIComponent(query)}`, {
      headers: { 
        'Cookie': session,
        'User-Agent': 'Mozilla/5.0 (CalibraCheck-Arkmeds-Integration/1.0)'
      }
    });
    const patHtml = await patRes.text();
    let m = patHtml.match(/href=[\"\']visual\/(\d+)\/[\"\']/i) || patHtml.match(/\/cadastros\/equipamento\/visual\/(\d+)\//i);
    if (m) {
      return processResolvedLocation(`/cadastros/equipamento/visual/${m[1]}/`, session, '');
    }
  } catch {}

  // 5. Busca por global_term
  try {
    const globRes = await fetch(`${BASE_URL}/cadastros/equipamento/?global_term=${encodeURIComponent(query)}`, {
      headers: { 
        'Cookie': session,
        'User-Agent': 'Mozilla/5.0 (CalibraCheck-Arkmeds-Integration/1.0)'
      }
    });
    const globHtml = await globRes.text();
    let m = globHtml.match(/href=[\"\']visual\/(\d+)\/[\"\']/i) || globHtml.match(/\/cadastros\/equipamento\/visual\/(\d+)\//i);
    if (m) {
      return processResolvedLocation(`/cadastros/equipamento/visual/${m[1]}/`, session, '');
    }
  } catch {}

  throw new Error(`Aparelho "${query}" não localizado em nenhum hospital do Arkmeds.`);
}

/**
 * Sincroniza / Consulta lista de equipamentos do Arkmeds (SOMENTE LEITURA)
 * Suporta filtro por Proprietário (ex: "LUIZ BUAIZ", "HIFA SUMARÉ") ou termo global.
 */
export async function syncArkmedsEquipments({ proprietario = '', query = '', maxPages = 10 } = {}) {
  const session = await getArkmedsSession();

  const allEquipments = [];
  let currentPage = 1;
  let totalPages = 1;
  let hasMore = true;

  const sanitizedMaxPages = Math.min(Math.max(1, parseInt(maxPages, 10) || 5), 100);

  while (hasMore && currentPage <= sanitizedMaxPages) {
    const urlParams = new URLSearchParams();
    if (proprietario) urlParams.append('proprietario', proprietario);
    if (query) urlParams.append('global_term', query);
    urlParams.append('page', String(currentPage));

    const listUrl = `${BASE_URL}/cadastros/equipamento/?${urlParams.toString()}`;

    const res = await fetch(listUrl, {
      headers: {
        'Cookie': session,
        'User-Agent': 'Mozilla/5.0 (CalibraCheck-Arkmeds-Integration/1.0)'
      }
    });

    if (!res.ok) {
      throw new Error(`Erro ao consultar página ${currentPage} no Arkmeds (Status ${res.status})`);
    }

    const html = await res.text();

    // Descobre total de páginas a partir do HTML da paginação
    const pagMatch = html.match(/<ul[^>]*class=[\"'][^\"']*pagination[^\"']*[\"'][^>]*>([\s\S]*?)<\/ul>/i);
    if (pagMatch) {
      const pageNums = [...pagMatch[1].matchAll(/page=(\d+)/g)].map(m => parseInt(m[1], 10));
      if (pageNums.length > 0) {
        totalPages = Math.max(...pageNums);
      }
    }

    // Extrai tabela
    const tableMatch = html.match(/<table[^>]*>([\s\S]*?)<\/table>/i);
    if (!tableMatch) break;

    const tbodyMatch = tableMatch[1].match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i) || tableMatch;
    const rowMatches = [...tbodyMatch[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];

    if (rowMatches.length === 0) break;

    for (const r of rowMatches) {
      const cells = [...r[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(c => c[1].replace(/<[^>]+>/g, '').trim());
      
      // As colunas padrão da tabela do Arkmeds são:
      // ['', '', '', '', '', '', 'ID', 'Tipo', 'Proprietário', 'Fabricante', 'Modelo', 'Estado', 'Identificação', 'Patrimônio', 'Número de série', ...]
      const idIdx = cells.findIndex((c, idx) => idx >= 4 && /^\d+$/.test(c));
      if (idIdx !== -1) {
        const id = cells[idIdx] || '';
        const tipo = cells[idIdx + 1] || '';
        const prop = cells[idIdx + 2] || '';
        const fabricante = cells[idIdx + 3] || '';
        const modelo = cells[idIdx + 4] || '';
        const estado = cells[idIdx + 5] || 'Ativo';
        const identificacao = cells[idIdx + 6] || '';
        const patrimonio = cells[idIdx + 7] || '';
        const serie = cells[idIdx + 8] || '';

        let setor = prop;
        let unidadeHospital = '';
        if (prop.includes(' - ')) {
          const parts = prop.split(' - ');
          setor = parts[0].trim();
          unidadeHospital = parts.slice(1).join(' - ').trim();
        }

        const equipNome = [tipo, fabricante, modelo].filter(Boolean).join(' ') || tipo || 'Equipamento';
        const cleanSerie = (serie === 'NÃO CONSTA' || serie === 'N/A' || serie === 'SEM SÉRIE') ? '' : serie;
        const cleanTag = (identificacao === 'N/A' || identificacao === 'SEM TAG') ? '' : identificacao;

        allEquipments.push({
          id: `ARK-${id}`,
          arkmedsId: id,
          codigoBarras: cleanSerie || cleanTag || id,
          tag: cleanTag || `TAG-${id}`,
          equipamento: equipNome,
          fabricante: fabricante || '',
          modelo: modelo || '',
          serie: cleanSerie,
          setor: setor || 'Geral',
          unidadeHospital: unidadeHospital || prop,
          proprietarioCompleto: prop,
          patrimonio: patrimonio !== 'N/A' ? patrimonio : '',
          estado,
          validadeCalibracao: 'N/A',
          statusCalibracao: 'Válido',
          checado: false,
          dataCheck: null,
          observacao: `Sincronizado do Arkmeds (ID: ${id})`,
          origem: 'arkmeds'
        });
      }
    }

    if (currentPage >= totalPages) {
      hasMore = false;
    } else {
      currentPage++;
    }
  }

  return {
    success: true,
    readOnly: true,
    totalCount: allEquipments.length,
    pagesFetched: currentPage - 1,
    totalPages,
    equipments: allEquipments
  };
}

/**
 * Verifica o status de conexão com o Arkmeds
 */
export async function checkArkmedsStatus() {
  try {
    const session = await getArkmedsSession();
    return {
      connected: Boolean(session),
      baseUrl: BASE_URL,
      user: ARKMEDS_EMAIL,
      readOnly: true,
      message: 'Conectado com sucesso ao Arkmeds (Modo Consulta e Sincronização - Somente Leitura)'
    };
  } catch (err) {
    return {
      connected: false,
      baseUrl: BASE_URL,
      user: ARKMEDS_EMAIL,
      readOnly: true,
      error: err.message
    };
  }
}

// ---------------- GESTÃO DE PLANOS MENSAIS ARKMEDS (SOMENTE LEITURA) ---------------- //

let cachedPlansList = null;
let cachedPlansListTime = 0;

/**
 * Lista todos os planos mensais cadastrados no Arkmeds (SOMENTE LEITURA)
 */
export async function listArkmedsPlans(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedPlansList && (now - cachedPlansListTime) < 15 * 60 * 1000) {
    return cachedPlansList;
  }

  const session = await getArkmedsSession();
  const res = await fetch(`${BASE_URL}/relatorio/planos/`, {
    headers: {
      'Cookie': session,
      'User-Agent': 'Mozilla/5.0 (CalibraCheck-Arkmeds-Integration/1.0)'
    }
  });

  if (!res.ok) {
    throw new Error(`Falha ao obter planos do Arkmeds (Status ${res.status})`);
  }

  const html = await res.text();
  const selectMatch = html.match(/<select[^>]*name=[\"\']planos[\"\'][^>]*>([\s\S]*?)<\/select>/i);
  if (!selectMatch) {
    return { success: true, count: 0, plans: [] };
  }

  const rawOpts = [...selectMatch[1].matchAll(/<option[^>]*value=[\"\'](\d+)[\"\'][^>]*>([\s\S]*?)<\/option>/gi)];
  const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

  const plans = [];

  for (const opt of rawOpts) {
    const id = opt[1];
    const rawTitle = opt[2].trim();
    if (rawTitle.toLowerCase() === 'excluir') continue;

    // Detect unit
    let unitTag = 'GERAL';
    let unitName = 'Geral / Outros';
    const upper = rawTitle.toUpperCase();

    if (upper.includes('HGLB') || upper.includes('LUIZ BUAIZ')) {
      unitTag = 'HGLB';
      unitName = 'Hospital Geral Dr. Luiz Buaiz';
    } else if (upper.includes('HA') || upper.includes('AQUIDABAN')) {
      unitTag = 'HA';
      unitName = 'HIFA Aquidaban';
    } else if (upper.includes('HM') || upper.includes('MATERNIDADE') || upper.includes('SUMARÉ') || upper.includes('SUMARE')) {
      unitTag = 'HM';
      unitName = 'HIFA Maternidade (Sumaré)';
    } else if (upper.includes('HG') || upper.includes('GUARAPARI')) {
      unitTag = 'HG';
      unitName = 'HIFA Guarapari';
    } else if (upper.includes('NEFROLOGIA')) {
      unitTag = 'NEFRO';
      unitName = 'Nefrologia';
    } else if (upper.includes('CME')) {
      unitTag = 'CME';
      unitName = 'Central de Material e Esterilização';
    } else if (upper.includes('IPEM')) {
      unitTag = 'IPEM';
      unitName = 'Verificação Anual IPEM';
    } else if (upper.includes('HL')) {
      unitTag = 'HGLB';
      unitName = 'Hospital Geral Dr. Luiz Buaiz';
    }

    // Detect month or period
    let period = 'Anual';
    const lower = rawTitle.toLowerCase();
    for (const m of MONTHS) {
      if (lower.includes(m)) {
        period = m.charAt(0).toUpperCase() + m.slice(1);
        break;
      }
    }
    if (period === 'Anual') {
      if (lower.includes('mensa')) period = 'Mensal';
      else if (lower.includes('bimestral')) period = 'Bimestral';
      else if (lower.includes('trimestral')) period = 'Trimestral';
      else if (lower.includes('semestral')) period = 'Semestral';
      else if (lower.includes('diária') || lower.includes('diaria')) period = 'Diária';
      else if (lower.includes('bianual')) period = 'Bianual';
    }

    plans.push({
      id,
      title: rawTitle,
      unitTag,
      unitName,
      period,
      readOnly: true
    });
  }

  // Sort by Unit then by Title
  plans.sort((a, b) => {
    if (a.unitTag !== b.unitTag) return a.unitTag.localeCompare(b.unitTag);
    return a.title.localeCompare(b.title);
  });

  cachedPlansList = {
    success: true,
    readOnly: true,
    count: plans.length,
    plans
  };
  cachedPlansListTime = now;

  return cachedPlansList;
}

/**
 * Consulta e extrai todos os equipamentos vinculados a um plano no Arkmeds (SOMENTE LEITURA)
 */
export async function fetchArkmedsPlanEquipments(planId) {
  if (!planId) throw new Error('ID do plano do Arkmeds é obrigatório.');

  const session = await getArkmedsSession();
  const csrfMatch = session.match(/csrftoken=([^;]+)/);
  const csrf = csrfMatch ? csrfMatch[1] : '';

  const formParams = new URLSearchParams();
  formParams.append('csrfmiddlewaretoken', csrf);
  formParams.append('planos', String(planId));

  const res = await fetch(`${BASE_URL}/relatorio/planos/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': session,
      'Referer': `${BASE_URL}/relatorio/planos/`,
      'User-Agent': 'Mozilla/5.0 (CalibraCheck-Arkmeds-Integration/1.0)'
    },
    body: formParams.toString()
  });

  if (!res.ok) {
    throw new Error(`Erro ao consultar equipamentos do plano no Arkmeds (Status ${res.status})`);
  }

  const html = await res.text();

  // Parsing sections by H3 (Sector / Hospital)
  const sections = html.split(/<h3[^>]*>/i);
  const equipments = [];

  for (let i = 1; i < sections.length; i++) {
    const sec = sections[i];
    const endH3 = sec.indexOf('</h3>');
    if (endH3 === -1) continue;

    const proprietario = sec.substring(0, endH3).trim();
    let setor = proprietario;
    let hospital = '';
    if (proprietario.includes(' - ')) {
      const parts = proprietario.split(' - ');
      setor = parts[0].trim();
      hospital = parts.slice(1).join(' - ').trim();
    }

    const equipBlocks = sec.split(/<h4[^>]*>/i);
    for (let j = 1; j < equipBlocks.length; j++) {
      const block = equipBlocks[j];
      const endH4 = block.indexOf('</h4>');
      if (endH4 === -1) continue;
      const h4Text = block.substring(0, endH4).replace(/<[^>]+>/g, '').trim();

      // "<Nome> tag: <Tag> ns: <Serie> p: <Patrimonio>"
      const match = h4Text.match(/^(.*?)\s+tag:\s*(\S+)\s+ns:\s*(\S+)\s+p:\s*(.*)$/i);
      let nome = h4Text;
      let tag = '';
      let serie = '';
      let patrimonio = '';

      if (match) {
        nome = match[1].trim();
        tag = match[2].trim() === 'N/A' ? '' : match[2].trim();
        serie = match[3].trim() === 'N/A' ? '' : match[3].trim();
        patrimonio = match[4].trim() === 'N/A' ? '' : match[4].trim();
      }

      // Ignora avisos de texto puro que não são equipamentos reais
      if (nome.toLowerCase().includes('não existe') || nome.toLowerCase().includes('nenhum agendamento') || (!tag && !serie && nome.length > 50)) {
        continue;
      }

      const tableRows = [...block.matchAll(/<tr>([\s\S]*?)<\/tr>/gi)];
      let tipoServico = '';
      let vencimento = '';
      let ultimaData = '';
      let frequencia = '';
      let estado = 'Ativo';

      for (const row of tableRows) {
        const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(c => c[1].replace(/<[^>]+>/g, '').trim());
        if (cells.length >= 6) {
          frequencia = cells[1] || '';
          ultimaData = cells[2] || '';
          vencimento = cells[3] || '';
          tipoServico = cells[4] || '';
          estado = cells[5] || 'Em dia';
        }
      }

      const cleanCode = tag || serie || `ARK-${planId}-${equipments.length + 1}`;

      equipments.push({
        id: `ARK-${tag || serie || (equipments.length + 1)}`,
        arkmedsPlanId: String(planId),
        codigoBarras: cleanCode,
        tag: tag || cleanCode,
        equipamento: nome,
        fabricante: '',
        modelo: '',
        serie: serie,
        patrimonio: patrimonio,
        setor: setor || 'Geral',
        unidadeHospital: hospital || proprietario,
        proprietarioCompleto: proprietario,
        tipoServico: tipoServico || 'Calibração',
        validadeCalibracao: vencimento || 'N/A',
        statusCalibracao: estado.toLowerCase().includes('dia') ? 'Válido' : (estado || 'Válido'),
        checado: false,
        dataCheck: null,
        frequencia,
        ultimaData,
        vencimento,
        observacao: `Plano Arkmeds (ID: ${planId}) • ${tipoServico || 'Calibração'}`,
        origem: 'arkmeds'
      });
    }
  }

  return {
    success: true,
    readOnly: true,
    planId: String(planId),
    totalEquipments: equipments.length,
    equipments
  };
}
