# 🔬 CalibraCheck - Check-in Rápido de Calibração

Sistema web moderno e ágil para **conferência e check-in de calibração de instrumentos e equipamentos** via código de barras, arquivos Excel (.xlsx, .xls, .csv) e Google Planilhas.

Desenvolvido para ser colocado no ar rapidamente e utilizado tanto no computador quanto no celular em campo, chão de fábrica ou laboratório.

---

## 🚀 Como Rodar Localmente

Certifique-se de ter o Node.js instalado (v18+) e execute na pasta do projeto:

```bash
# 1. Instalar dependências (caso ainda não tenha feito)
npm install

# 2. Iniciar servidor de desenvolvimento
npm run dev
```

O aplicativo estará acessível em:
- **No seu computador:** `http://localhost:3000`
- **No celular (na mesma rede Wi-Fi):** `http://<seu-ip-local>:3000` (ex: `http://192.168.100.48:3000`)

---

## ⚡ Como Colocar no Ar em 2 Minutos (Deploy Grátis)

### Opção 1: Vercel (Recomendado - 1 clique)
1. Instale a CLI da Vercel (se desejar): `npm i -g vercel` e rode `vercel`
2. Ou suba para o GitHub e importe o repositório na [vercel.com](https://vercel.com).
3. Configurações automáticas:
   - Framework Preset: **Vite**
   - Build Command: `npm run build`
   - Output Directory: `dist`

### Opção 2: Netlify
1. Arraste a pasta `dist` gerada por `npm run build` diretamente no painel do [Netlify Drop](https://app.netlify.com/drop).
2. O site fica no ar na hora com HTTPS gratuito!

### Opção 3: Cloudflare Pages
1. Conecte ao repositório Git no Cloudflare Pages.
2. Build command: `npm run build`
3. Output directory: `dist`

---

## ✨ Principais Funcionalidades

### 1. 📷 Leitura de Código de Barras e QR Code
- **Câmera do Celular / Notebook:** Leitor embutido com seletor de câmera frontal/traseira, lanterna/flash e modo contínuo (bipa vários aparelhos em sequência sem fechar).
- **Pistola de Código de Barras USB / Bluetooth:** Funciona automaticamente! Basta apontar e disparar a pistola em qualquer lugar da tela que o sistema reconhece o código e dá check.
- **Campo de Busca Rápida:** Digite ou cole o código e pressione `Enter`.

### 2. 📊 Importação Flexível
- **Excel (.xlsx e .xls) e CSV:** Arraste e solte o arquivo em qualquer lugar da tela ou clique em "Importar".
- **Google Planilhas:**
  - Cole o link compartilhado da planilha pública do Google Drive.
  - Ou use a aba **"Copiar e Colar"** (selecione as células no Google Sheets, dê `Ctrl+C` e cole no app — funciona até com planilhas privadas corporativas!).
- **Mapeamento Inteligente:** Detecta automaticamente colunas com nomes como *Código de Barras, Patrimônio, Tag, Equipamento, Descrição, Modelo, Série, Setor, Validade de Calibração, Status, Checado*.

### 3. 🔊 Feedback Sonoro Imediato
- Sons sintetizados via Web Audio API:
  - 🔔 **Chime agudo:** Equipamento encontrado e marcado como checado!
  - ⚠️ **Tom duplo:** Equipamento já havia sido checado anteriormente.
  - 🛑 **Tom grave:** Código de barras não encontrado na planilha.
- Vibração háptica no celular.

### 4. 🔍 Busca Inteligente & Filtros
- Barra de busca instantânea que pesquisa por nome do aparelho, tag, modelo, número de série ou setor.
- Filtros rápidos por cartões:
  - **Todos os Aparelhos**
  - **Checados / OK**
  - **Pendentes de Bipagem**
  - **Calibração Vencida ou Em Alerta (A Vencer em 30 dias)**
- Filtro por Setor / Localidade.

### 5. 💾 Persistência & Exportação
- **Salvamento Automático:** Todos os dados e marcações de check ficam salvos no navegador (`localStorage`). Se atualizar a página ou fechar sem querer, nada é perdido.
- **Download em Excel (.xlsx):** Gera uma nova planilha formatada com a coluna de Check atualizada, além da data e hora exatas de conferência de cada aparelho!
- **Chuva de Confetes 🎉:** Celebração automática quando 100% dos equipamentos da lista forem checados.

---

## 🛠️ Tecnologias Utilizadas

- **React 19**
- **Vite 6**
- **Tailwind CSS v4**
- **SheetJS (xlsx)**: Manipulação rápida de planilhas Excel no navegador
- **html5-qrcode**: Leitor de códigos 1D e 2D via câmera
- **Lucide Icons**: Ícones modernos e consistentes
- **Canvas-Confetti**: Efeito visual de meta atingida

