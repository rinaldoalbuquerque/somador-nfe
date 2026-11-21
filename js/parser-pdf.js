/**
 * Somador de Notas - Parser de Arquivos PDF (DANFE)
 * Extração de texto digital via PDF.js com fallback de OCR via Tesseract.js para páginas escaneadas.
 * Suporta PDFs de múltiplas páginas e layouts reais de ERPs (colunares, espaçados e em lote).
 */

const PdfParser = {
  /**
   * Configura o worker do PDF.js
   * Suporta tanto protocolo http:// (worker externo) quanto file:/// (fallback seguro)
   */
  init() {
    if (window.pdfjsLib) {
      if (window.location.protocol === 'file:') {
        // No protocolo file:///, o Chrome bloqueia workers externos devido a restrições de sandbox
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = '';
      } else {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';
      }
    }
  },

  /**
   * Extrai texto e dados de um arquivo PDF
   * @param {File|Blob} file
   * @param {Function} onProgress Callback de progresso (percentual, mensagem)
   * @returns {Promise<Array<Object>>} Lista de notas encontradas no PDF
   */
  async parse(file, onProgress = null) {
    this.init();

    if (!window.pdfjsLib) {
      throw new Error('Biblioteca PDF.js não está carregada.');
    }

    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await window.pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
    const numPages = pdfDoc.numPages;

    if (onProgress) onProgress(10, `Lendo PDF (${numPages} página${numPages > 1 ? 's' : ''})...`);

    // 1. Extrair itens e texto de cada página individualmente
    const pagesData = [];
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      if (onProgress) {
        const pct = 10 + Math.floor((pageNum / numPages) * 40);
        onProgress(pct, `Extraindo texto da página ${pageNum} de ${numPages}...`);
      }

      const page = await pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      // Preservar coordenadas espaciais para extração precisa de tabelas e valores
      const items = textContent.items.map(item => ({
        str: item.str.trim(),
        x: Math.round(item.transform[4]),
        y: Math.round(item.transform[5])
      })).filter(item => item.str.length > 0);

      let textItems = textContent.items.map(item => item.str);
      let pageText = textItems.join(' ').replace(/\s+/g, ' ').trim();

      // Se a página tem muito pouco texto digital (ex: escaneada), executa OCR
      let isScanned = false;
      if (pageText.length < 35 || (!pageText.includes('DANFE') && !pageText.match(/\d{4}\s*\d{4}/))) {
        if (onProgress) onProgress(null, `Executando OCR na página escaneada ${pageNum}...`);
        try {
          const ocrResult = await this.runOcrOnPage(page);
          if (ocrResult && ocrResult.length > pageText.length) {
            pageText = ocrResult;
            isScanned = true;
          }
        } catch (ocrErr) {
          console.warn(`OCR não disponível ou falhou na pág ${pageNum}:`, ocrErr);
        }
      }

      pagesData.push({
        pageNum,
        text: pageText,
        items,
        isScanned
      });
    }

    if (onProgress) onProgress(60, 'Identificando notas e DANFEs nas páginas...');

    // 2. Agrupar páginas por nota fiscal
    const invoiceGroups = this.groupPagesIntoInvoices(pagesData, file.name);

    const results = [];
    const pdfBlobUrl = URL.createObjectURL(file);

    for (let i = 0; i < invoiceGroups.length; i++) {
      const group = invoiceGroups[i];
      const combinedText = group.pages.map(p => p.text).join('\n---\n');
      const allItems = group.pages.flatMap(p => p.items || []);
      const invoiceIndex = invoiceGroups.length > 1 ? ` (Nota ${i + 1} de ${invoiceGroups.length})` : '';
      const displayFileName = file.name + invoiceIndex;

      // Verificar se é documento não suportado (ex: NFS-e ou CT-e)
      const unsupportedCheck = this.checkUnsupportedDocument(combinedText, displayFileName);
      if (unsupportedCheck) {
        results.push({
          ...unsupportedCheck,
          pdfFile: file,
          pdfUrl: pdfBlobUrl,
          pageNumbers: group.pages.map(p => p.pageNum)
        });
        continue;
      }

      // Extração de dados da NF-e no texto e itens do grupo
      const extracted = this.extractFields(combinedText, allItems, file.name, displayFileName);
      results.push({
        ...extracted,
        pdfFile: file,
        pdfUrl: pdfBlobUrl,
        pageNumbers: group.pages.map(p => p.pageNum),
        multiPagePdf: numPages > 1,
        totalPdfPages: numPages
      });
    }

    if (onProgress) onProgress(100, 'Processamento de PDF concluído.');
    return results;
  },

  /**
   * Agrupa páginas pertencentes à mesma nota fiscal
   */
  groupPagesIntoInvoices(pagesData, fileName = '') {
    const groups = [];
    let currentGroup = null;

    for (const page of pagesData) {
      const text = page.text;
      const chaveMatch = this.findChave(text, fileName);
      const folhaMatch = text.match(/FOLHA\s+(\d+)\s*[/de]+\s*(\d+)/i) || text.match(/P[AÁ]G(?:INA)?\s*(\d+)\s*[/de]+\s*(\d+)/i);
      const folhaAtual = folhaMatch ? parseInt(folhaMatch[1], 10) : 1;

      if (!currentGroup) {
        currentGroup = {
          chave: chaveMatch,
          pages: [page]
        };
      } else {
        const isSameChave = chaveMatch && currentGroup.chave && (chaveMatch === currentGroup.chave);
        const isNextSheet = folhaAtual > 1;

        if (isSameChave || (isNextSheet && !chaveMatch)) {
          currentGroup.pages.push(page);
          if (!currentGroup.chave && chaveMatch) {
            currentGroup.chave = chaveMatch;
          }
        } else if (chaveMatch && currentGroup.chave && chaveMatch !== currentGroup.chave) {
          groups.push(currentGroup);
          currentGroup = {
            chave: chaveMatch,
            pages: [page]
          };
        } else {
          if (text.toLowerCase().includes('continua') || text.toLowerCase().includes('dados dos produtos') || isNextSheet) {
            currentGroup.pages.push(page);
          } else {
            if (text.toUpperCase().includes('DANFE') && text.toUpperCase().includes('DOCUMENTO AUXILIAR')) {
              groups.push(currentGroup);
              currentGroup = {
                chave: chaveMatch,
                pages: [page]
              };
            } else {
              currentGroup.pages.push(page);
            }
          }
        }
      }
    }

    if (currentGroup && currentGroup.pages.length > 0) {
      groups.push(currentGroup);
    }

    return groups;
  },

  /**
   * Procura chave de acesso de 44 dígitos no texto ou nome do arquivo
   */
  findChave(text, fileName = '') {
    if (!text && !fileName) return null;

    // 1. Padrão formatado com espaços: 11 grupos de 4 dígitos
    const formattedMatch = text ? text.match(/\b(\d{4}\s+\d{4}\s+\d{4}\s+\d{4}\s+\d{4}\s+\d{4}\s+\d{4}\s+\d{4}\s+\d{4}\s+\d{4}\s+\d{4})\b/) : null;
    if (formattedMatch) {
      const clean = Utils.cleanChave(formattedMatch[1]);
      if (clean.length === 44) return clean;
    }

    // 2. Padrão contínuo de 44 dígitos no texto
    const continuousMatch = text ? text.match(/\b(\d{44})\b/) : null;
    if (continuousMatch) {
      return continuousMatch[1];
    }

    // 3. Próximo ao termo "CHAVE DE ACESSO"
    if (text) {
      const chaveIdx = text.toUpperCase().indexOf('CHAVE DE ACESSO');
      if (chaveIdx !== -1) {
        const snippet = text.substring(chaveIdx, chaveIdx + 150);
        const digits = snippet.replace(/\D/g, '');
        if (digits.length >= 44) {
          return digits.substring(0, 44);
        }
      }
    }

    // 4. No nome do arquivo (muito comum em downloads de ERPs: ex: 7492022381_352611...-procNFe.pdf)
    if (fileName) {
      const fnMatch = fileName.match(/(\d{44})/);
      if (fnMatch) return fnMatch[1];
      const fn35Match = fileName.match(/35\d{42}/);
      if (fn35Match) return fn35Match[0];
    }

    return null;
  },

  /**
   * Verifica se o PDF é um documento não suportado (NFS-e ou CT-e)
   */
  checkUnsupportedDocument(text, fileName) {
    const upper = text.toUpperCase();
    if (upper.includes('NOTA FISCAL DE SERVIÇOS') || upper.includes('NOTA FISCAL DE SERVICOS') || upper.includes('NFS-E') || upper.includes('RECIBO PROVISÓRIO DE SERVIÇOS')) {
      return {
        success: false,
        isUnsupported: true,
        tipoDocumento: 'NFS-e',
        fileName,
        error: 'Nota Fiscal de Serviços Eletrônica (NFS-e) não é suportada nesta versão. Apenas NF-e (modelo 55) é aceita.'
      };
    }
    if (upper.includes('CONHECIMENTO DE TRANSPORTE ELETRÔNICO') || upper.includes('CONHECIMENTO DE TRANSPORTE ELETRONICO') || (upper.includes('DACTE') && !upper.includes('DANFE')) || upper.includes('CT-E')) {
      return {
        success: false,
        isUnsupported: true,
        tipoDocumento: 'CT-e',
        fileName,
        error: 'Conhecimento de Transporte Eletrônico (CT-e) não é suportado nesta versão. Apenas NF-e (modelo 55) é aceita.'
      };
    }
    return null;
  },

  /**
   * Extrai a Natureza da Operação do DANFE.
   * 1º tenta pela posição espacial (valor logo abaixo do rótulo);
   * 2º tenta pelo texto corrido (valor logo após o rótulo).
   */
  extractNaturezaOperacao(text, items = []) {
    const isLabel = s => /NATUREZA\s*DA\s*OPERA/i.test(s);
    const otherLabel = /^(PROTOCOLO|INSCRI|CNPJ|CHAVE|DATA|N[ºO°]|S[EÉ]RIE|FOLHA|DESTINAT|NOME|DANFE)/i;
    const clean = s => s.replace(/NATUREZA\s*DA\s*OPERA[ÇC][ÃA]O\s*[:\-]?/i, '').trim();

    // 1. Análise espacial
    if (items && items.length) {
      const label = items.find(it => isLabel(it.str));
      if (label) {
        // Valor na mesma string do rótulo (ex: "NATUREZA DA OPERAÇÃO: VENDA")
        const inline = clean(label.str);
        if (inline.length >= 3) return inline.toUpperCase();

        // Valor logo abaixo do rótulo (PDF: y cresce para cima)
        const below = items
          .filter(it => it !== label && it.y < label.y && label.y - it.y <= 25 &&
                        Math.abs(it.x - label.x) <= 60 && !otherLabel.test(it.str) && /[A-Za-z]/.test(it.str))
          .sort((a, b) => (b.y - a.y) || (a.x - b.x));
        if (below.length) {
          const lineY = below[0].y;
          // Limite direito da coluna: próximo rótulo na mesma linha do rótulo (ex: PROTOCOLO)
          const nextLabel = items
            .filter(it => it !== label && Math.abs(it.y - label.y) <= 3 && it.x > label.x + 20)
            .sort((a, b) => a.x - b.x)[0];
          const maxX = nextLabel ? nextLabel.x - 5 : label.x + 300;
          const line = items
            .filter(it => Math.abs(it.y - lineY) <= 2 && it.x >= label.x - 15 && it.x < maxX && !otherLabel.test(it.str))
            .sort((a, b) => a.x - b.x);
          const value = line.map(it => it.str).join(' ').trim();
          if (value.length >= 3) return value.toUpperCase();
        }
      }
    }

    // 2. Texto corrido
    if (text) {
      const m = text.match(/NATUREZA\s*DA\s*OPERA[ÇC][ÃA]O\s*[:\-]?\s*(.{3,80}?)(?=\s+(PROTOCOLO|INSCRI|CNPJ|CHAVE|DATA|DESTINAT)|$)/i);
      if (m && m[1]) {
        const value = m[1].trim();
        if (/[A-Za-z]/.test(value)) return value.toUpperCase();
      }
    }
    return '';
  },

  /**
   * Extrai campos estruturados do DANFE combinando análise textual e espacial
   */
  extractFields(text, items, originalFileName, displayFileName) {
    const chave = this.findChave(text, originalFileName);

    // Decomposição padrão SEFAZ da Chave de Acesso de 44 dígitos
    let chaveCnpj = '';
    let chaveSerie = '';
    let chaveNumero = '';
    let chaveData = '';

    if (chave && chave.length === 44) {
      chaveCnpj = chave.substring(6, 20);
      chaveSerie = String(parseInt(chave.substring(22, 25), 10));
      chaveNumero = String(parseInt(chave.substring(25, 34), 10));
      const yy = chave.substring(2, 4);
      const mm = chave.substring(4, 6);
      chaveData = `20${yy}-${mm}-01`;
    }

    // 1. Extração do Número da NF-e
    let numero = chaveNumero || '-';
    if (!numero || numero === '-') {
      const numMatch = text.match(/N[º°.]\s*([0-9.]+)/i) || 
                       text.match(/N[ÚU]MERO\s*[:.]?\s*([0-9.]+)/i) ||
                       text.match(/NF-e\s*N[º°.]?\s*([0-9.]+)/i);
      if (numMatch) {
        numero = numMatch[1].replace(/\./g, '').trim();
      }
    }

    // 2. Extração da Série
    let serie = chaveSerie || '1';
    if (!serie) {
      const serieMatch = text.match(/S[EÉ]RIE\s*[:.]?\s*(\d{1,3})/i);
      if (serieMatch) {
        serie = serieMatch[1].trim();
      }
    }

    // 3. Extração da Data de Emissão
    let dhEmi = '';
    const dateMatch = text.match(/\b(\d{2}\/\d{2}\/\d{4})\b/);
    if (dateMatch) {
      const parts = dateMatch[1].split('/');
      dhEmi = `${parts[2]}-${parts[1]}-${parts[0]}`;
    } else if (chaveData) {
      dhEmi = chaveData;
    }

    // 4. Extração do CNPJ do Emitente
    let emitCnpj = chaveCnpj || '';
    if (!emitCnpj) {
      const cnpjEmitMatch = text.match(/CNPJ\s*[:.]?\s*(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/i) ||
                            text.match(/(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/);
      if (cnpjEmitMatch) {
        emitCnpj = Utils.cleanChave(cnpjEmitMatch[1]);
      }
    }

    // 5. Extração do Nome do Emitente
    let emitNome = this.extractEmitenteName(text);

    // 6. Extração do Destinatário
    let destNome = '';
    let destCnpj = '';
    const destIdx = text.toUpperCase().indexOf('DESTINAT');
    if (destIdx !== -1) {
      const destSnippet = text.substring(destIdx, destIdx + 300);
      const destCnpjMatch = destSnippet.match(/(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/) ||
                            destSnippet.match(/(\d{3}\.\d{3}\.\d{3}-\d{2})/);
      if (destCnpjMatch) {
        destCnpj = Utils.cleanChave(destCnpjMatch[1]);
      }
      const destNomeMatch = destSnippet.match(/NOME\s*[/]?\s*RAZ[AÃ]O\s+SOCIAL\s*[:.]?\s*([A-Z0-9\s.,&-]{4,60})/i);
      if (destNomeMatch) {
        destNome = destNomeMatch[1].trim();
      }
    }

    // 7. Extração Robusta do VALOR TOTAL DA NOTA
    const valorExtraction = this.extractTotalValue(text, items);
    const valorCents = valorExtraction.cents;
    const isConfident = valorExtraction.isConfident;

    // Verificar se é devolução
    const isDevolucao = text.toUpperCase().includes('DEVOLUÇÃO') || text.toUpperCase().includes('DEVOLUCAO');
    const situacaoFiscal = isDevolucao ? 'devolucao' : 'normal';

    // Regra de conferência: requer revisão apenas se não houver valor determinado com segurança
    const precisaRevisao = !isConfident || valorCents <= 0 || (!chave && (!emitCnpj || numero === '-'));

    return {
      success: true,
      fileName: displayFileName,
      origem: 'PDF',
      chave: chave || '',
      numero,
      serie,
      dhEmi,
      naturezaOperacao: this.extractNaturezaOperacao(text, items) || (isDevolucao ? 'DEVOLUÇÃO' : 'NÃO IDENTIFICADA'),
      tpNF: 'Saída',
      isDevolucao,
      emitente: {
        nome: emitNome,
        cnpjCpf: emitCnpj,
        ie: ''
      },
      destinatario: {
        nome: destNome || 'Destinatário identificado via PDF',
        cnpjCpf: destCnpj,
        ie: ''
      },
      valorCents: valorCents || 0,
      statusLeitura: precisaRevisao ? 'revisao' : 'sucesso',
      motivoRevisao: precisaRevisao ? (valorExtraction.reason || 'Validação de campos obrigatórios necessária') : null,
      situacaoFiscal,
      incluidaNaSoma: !precisaRevisao, // Entra na soma automaticamente se não necessitar de revisão!
      editadoManualmente: false,
      duplicada: false,
      divergencia: false,
      divergenciaDetalhes: null,
      rawText: text
    };
  },

  /**
   * Extração do Nome do Emitente
   */
  extractEmitenteName(text) {
    // 1. Canhoto oficial da SEFAZ: "RECEBEMOS DE [NOME DO EMITENTE] OS PRODUTOS CONSTANTES DA NOTA FISCAL"
    const canhotoMatch = text.match(/RECEBEMOS DE\s+([A-Z0-9\s.,&'-]+?)\s+OS PRODUTOS/i);
    if (canhotoMatch && canhotoMatch[1].trim().length > 4) {
      const nome = canhotoMatch[1].trim();
      if (!nome.toUpperCase().includes('NOTA FISCAL') && !nome.toUpperCase().includes('SÉRIE')) {
        return nome;
      }
    }

    // 2. Bloco do emitente antes do quadro DANFE
    const danfePos = text.toUpperCase().indexOf('DANFE');
    if (danfePos > 20) {
      const headerSnippet = text.substring(0, danfePos);
      const lines = headerSnippet.split(/\n|\r|\s{3,}/).map(l => l.trim()).filter(l => l.length > 3);
      for (const line of lines) {
        const up = line.toUpperCase();
        if (up.includes('NF-E') || up.includes('RECEBIMENTO') || up.includes('IDENTIFICACAO') || up.includes('SÉRIE') || up.includes('SERIE') || up.includes('FOLHA')) {
          continue;
        }
        return line.substring(0, 70);
      }
    }

    // 3. Fallback genérico
    const emitMatch = text.match(/EMITENTE\s*[:.]?\s*([A-Z0-9\s.,&-]{4,60})/i);
    if (emitMatch) {
      return emitMatch[1].trim();
    }

    return 'Emitente identificado via PDF';
  },

  /**
   * Extração do VALOR TOTAL DA NOTA
   * Combina coordenadas espaciais, colunas do quadro CÁLCULO DO IMPOSTO e fluxo de itens
   */
  extractTotalValue(text, items = []) {
    // 1. Abordagem Espacial Precisa (Procura pelo rótulo "VALOR TOTAL DA NOTA" no grid)
    if (items && items.length > 0) {
      const labelItem = items.find(i => {
        const s = i.str.toUpperCase().trim();
        return s === 'VALOR TOTAL DA NOTA' || s === 'V. TOTAL DA NOTA' || s.endsWith('TOTAL DA NOTA');
      });

      if (labelItem) {
        const lx = labelItem.x;
        const ly = labelItem.y;

        // Procurar números monetários na mesma coluna logo abaixo do rótulo
        const candidateItems = items.filter(i => {
          const dy = ly - i.y;
          return dy >= 4 && dy <= 45 && i.x >= (lx - 60);
        });

        for (const cand of candidateItems) {
          const m = cand.str.match(/\b([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})\b/);
          if (m) {
            const cents = Utils.parseMoneyToCents(m[1]);
            if (cents > 0) {
              return { cents, isConfident: true, method: 'spatial_exact' };
            }
          }
        }
      }

      // 2. Abordagem pela coluna extrema direita do quadro Cálculo do Imposto (x >= 440, y entre 420 e 520)
      const rightColMoney = items.filter(i => {
        if (i.x < 440) return false;
        if (i.y < 420 || i.y > 530) return false;
        return i.str.match(/\b([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})\b/);
      });

      if (rightColMoney.length > 0) {
        // O valor total da nota é o item da coluna direita (ou o maior/último não nulo)
        for (let k = rightColMoney.length - 1; k >= 0; k--) {
          const m = rightColMoney[k].str.match(/\b([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})\b/);
          if (m) {
            const cents = Utils.parseMoneyToCents(m[1]);
            if (cents > 0) {
              return { cents, isConfident: true, method: 'right_column' };
            }
          }
        }
      }
    }

    // 3. Abordagem Sequencial no Texto (Rótulos do Cálculo do Imposto)
    const upper = text.toUpperCase();
    const totalLabels = [
      'VALOR TOTAL DA NOTA',
      'V. TOTAL DA NOTA',
      'VALOR TOTAL DO DOCUMENTO',
      'VALOR DA NOTA'
    ];

    for (const label of totalLabels) {
      const idx = upper.indexOf(label);
      if (idx !== -1) {
        const snippet = text.substring(idx + label.length, idx + label.length + 180);
        // Coleta todos os números monetários no trecho seguinte
        const matches = [...snippet.matchAll(/(?:R\$\s*)?([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})/g)];
        if (matches.length > 0) {
          // Em layouts com todos os labels seguidos de todos os valores:
          // Procurar o primeiro valor não-zero no bloco de totais
          for (let m of matches) {
            const cents = Utils.parseMoneyToCents(m[1]);
            if (cents > 0) {
              return { cents, isConfident: true, method: 'text_sequence' };
            }
          }
        }
      }
    }

    // 4. Abordagem por "VALOR TOTAL DOS PRODUTOS" como referência contábil
    const prodMatch = text.match(/VALOR TOTAL DOS PRODUTOS\D+([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})/i);
    if (prodMatch) {
      const cents = Utils.parseMoneyToCents(prodMatch[1]);
      if (cents > 0) {
        return { cents, isConfident: true, method: 'vProd_reference' };
      }
    }

    // 5. Abordagem no rodapé de produtos / faturas
    const tableTotalMatch = text.match(/VALOR\s+TOTAL\D+([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})/i);
    if (tableTotalMatch) {
      const cents = Utils.parseMoneyToCents(tableTotalMatch[1]);
      if (cents > 0) {
        return { cents, isConfident: true, method: 'table_total' };
      }
    }

    return {
      cents: 0,
      isConfident: false,
      reason: 'Valor Total da Nota não identificado com segurança no documento.'
    };
  },

  /**
   * Executa OCR em uma página específica renderizada em canvas
   */
  async runOcrOnPage(pdfPage) {
    if (!window.Tesseract) {
      return '';
    }

    const viewport = pdfPage.getViewport({ scale: 1.5 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');

    await pdfPage.render({
      canvasContext: ctx,
      viewport: viewport
    }).promise;

    const worker = await window.Tesseract.createWorker('por');
    const ret = await worker.recognize(canvas);
    await worker.terminate();

    return ret.data.text;
  }
};
