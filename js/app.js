/**
 * Somador de Notas - Aplicação Principal (Controller & UI)
 * Orquestração de leitura em lote, conferência, desduplicação, filtros e somas seguras.
 */

class SomadorApp {
  constructor() {
    this.notas = [];
    this.cancellationEventsMap = new Map(); // chave -> dados do evento
    this.selectedIds = new Set();
    this.currentReviewNota = null;
    this.currentPdfDoc = null;
    this.currentPdfPage = 1;
    this.currentPdfScale = 1.0;
    this.isProcessingCancelled = false;

    this.filters = {
      search: '',
      dataInicio: '',
      dataFim: '',
      situacao: 'todas',
      origem: 'todas',
      natureza: 'todas'
    };

    this.initElements();
    this.bindEvents();
    this.updateUI();
  }

  initElements() {
    // Dropzone & Arquivos
    this.dropzone = document.getElementById('dropzone');
    this.fileInput = document.getElementById('fileInput');
    this.btnSelectFiles = document.getElementById('btnSelectFiles');
    this.btnLoadSamples = document.getElementById('btnLoadSamples');

    // Cards
    this.cardTotalValor = document.getElementById('cardTotalValor');
    this.cardTotalDesc = document.getElementById('cardTotalDesc');
    this.cardQtdIncluidas = document.getElementById('cardQtdIncluidas');
    this.cardQtdDuplicadas = document.getElementById('cardQtdDuplicadas');
    this.cardQtdPendencias = document.getElementById('cardQtdPendencias');

    // Filtros
    this.filterSearch = document.getElementById('filterSearch');
    this.filterDataInicio = document.getElementById('filterDataInicio');
    this.filterDataFim = document.getElementById('filterDataFim');
    this.filterSituacao = document.getElementById('filterSituacao');
    this.filterOrigem = document.getElementById('filterOrigem');
    this.filterNatureza = document.getElementById('filterNatureza');
    this.naturezaTableBody = document.getElementById('naturezaTableBody');
    this.lblTotalVendas = document.getElementById('lblTotalVendas');
    this.lblTotalVendasDesc = document.getElementById('lblTotalVendasDesc');
    this.btnClearFilters = document.getElementById('btnClearFilters');

    // Subtotais
    this.lblTotalGeral = document.getElementById('lblTotalGeral');
    this.lblSubtotalFiltrado = document.getElementById('lblSubtotalFiltrado');
    this.lblSubtotalFiltradoContainer = document.getElementById('lblSubtotalFiltradoContainer');

    // Tabela e Toolbar
    this.notasTable = document.getElementById('notasTable');
    this.tableBody = document.getElementById('tableBody');
    this.emptyState = document.getElementById('emptyState');
    this.chkSelectAll = document.getElementById('chkSelectAll');
    this.batchActionsBar = document.getElementById('batchActionsBar');
    this.batchSelectedCount = document.getElementById('batchSelectedCount');
    this.btnBatchInclude = document.getElementById('btnBatchInclude');
    this.btnBatchExclude = document.getElementById('btnBatchExclude');
    this.btnBatchDelete = document.getElementById('btnBatchDelete');

    // Ações Globais
    this.btnExportExcel = document.getElementById('btnExportExcel');
    this.btnExportPdf = document.getElementById('btnExportPdf');
    this.btnClearAll = document.getElementById('btnClearAll');

    // Modais
    this.modalProgress = document.getElementById('modalProgress');
    this.progressCurrentFile = document.getElementById('progressCurrentFile');
    this.progressCounter = document.getElementById('progressCounter');
    this.progressBarFill = document.getElementById('progressBarFill');
    this.progressLog = document.getElementById('progressLog');
    this.btnCancelProcessing = document.getElementById('btnCancelProcessing');

    this.modalDanfe = document.getElementById('modalDanfe');
    this.danfeModalBody = document.getElementById('danfeModalBody');
    this.btnCloseDanfe = document.getElementById('btnCloseDanfe');
    this.btnCloseDanfeFooter = document.getElementById('btnCloseDanfeFooter');
    this.btnPrintDanfe = document.getElementById('btnPrintDanfe');
    this.btnDownloadXmlOriginal = document.getElementById('btnDownloadXmlOriginal');

    this.modalReview = document.getElementById('modalReview');
    this.btnCloseReview = document.getElementById('btnCloseReview');
    this.btnCancelReview = document.getElementById('btnCancelReview');
    this.btnSaveReview = document.getElementById('btnSaveReview');
    this.reviewNoticeBox = document.getElementById('reviewNoticeBox');
    this.pdfViewerCanvas = document.getElementById('pdfViewerCanvas');
    this.pdfPageIndicator = document.getElementById('pdfPageIndicator');
    this.btnPdfPrevPage = document.getElementById('btnPdfPrevPage');
    this.btnPdfNextPage = document.getElementById('btnPdfNextPage');
    this.btnPdfZoomIn = document.getElementById('btnPdfZoomIn');
    this.btnPdfZoomOut = document.getElementById('btnPdfZoomOut');

    // Campos de Edição da Nota
    this.editValorTotal = document.getElementById('editValorTotal');
    this.editChave = document.getElementById('editChave');
    this.editNumero = document.getElementById('editNumero');
    this.editSerie = document.getElementById('editSerie');
    this.editDataEmissao = document.getElementById('editDataEmissao');
    this.editEmitenteNome = document.getElementById('editEmitenteNome');
    this.editEmitenteCnpj = document.getElementById('editEmitenteCnpj');
    this.editDestinatarioNome = document.getElementById('editDestinatarioNome');
    this.editNatureza = document.getElementById('editNatureza');
    this.editIncluirSoma = document.getElementById('editIncluirSoma');

    this.modalConfirmClear = document.getElementById('modalConfirmClear');
    this.btnCancelClear = document.getElementById('btnCancelClear');
    this.btnConfirmClear = document.getElementById('btnConfirmClear');
  }

  bindEvents() {
    // Seleção de Arquivos e Dropzone
    if (this.btnSelectFiles && this.fileInput) {
      this.btnSelectFiles.addEventListener('click', () => this.fileInput.click());
      this.fileInput.addEventListener('change', (e) => this.handleFileSelection(e.target.files));
    }

    // Drag and Drop
    if (this.dropzone) {
      ['dragenter', 'dragover'].forEach(eventName => {
        this.dropzone.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.dropzone.classList.add('dragover');
        });
      });

      ['dragleave', 'drop'].forEach(eventName => {
        this.dropzone.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.dropzone.classList.remove('dragover');
        });
      });

      this.dropzone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        if (dt && dt.files && dt.files.length > 0) {
          this.handleFileSelection(dt.files);
        }
      });
    }

    // Filtros
    if (this.filterSearch) {
      this.filterSearch.addEventListener('input', (e) => {
        this.filters.search = e.target.value.toLowerCase().trim();
        this.updateUI();
      });
    }

    if (this.filterDataInicio) {
      this.filterDataInicio.addEventListener('change', (e) => {
        this.filters.dataInicio = e.target.value;
        this.updateUI();
      });
    }

    if (this.filterDataFim) {
      this.filterDataFim.addEventListener('change', (e) => {
        this.filters.dataFim = e.target.value;
        this.updateUI();
      });
    }

    if (this.filterSituacao) {
      this.filterSituacao.addEventListener('change', (e) => {
        this.filters.situacao = e.target.value;
        this.updateUI();
      });
    }

    if (this.filterOrigem) {
      this.filterOrigem.addEventListener('change', (e) => {
        this.filters.origem = e.target.value;
        this.updateUI();
      });
    }

    if (this.filterNatureza) {
      this.filterNatureza.addEventListener('change', (e) => {
        this.filters.natureza = e.target.value;
        this.updateUI();
      });
    }

    // Clique em uma linha do resumo por natureza aplica o filtro correspondente
    if (this.naturezaTableBody) {
      this.naturezaTableBody.addEventListener('click', (e) => {
        const tr = e.target.closest('tr[data-natureza]');
        if (!tr) return;
        const value = tr.getAttribute('data-natureza');
        this.filters.natureza = this.filters.natureza === value ? 'todas' : value;
        this.updateUI();
      });
    }

    if (this.btnClearFilters) {
      this.btnClearFilters.addEventListener('click', () => {
        if (this.filterSearch) this.filterSearch.value = '';
        if (this.filterDataInicio) this.filterDataInicio.value = '';
        if (this.filterDataFim) this.filterDataFim.value = '';
        if (this.filterSituacao) this.filterSituacao.value = 'todas';
        if (this.filterOrigem) this.filterOrigem.value = 'todas';
        if (this.filterNatureza) this.filterNatureza.value = 'todas';
        this.filters = { search: '', dataInicio: '', dataFim: '', situacao: 'todas', origem: 'todas', natureza: 'todas' };
        this.updateUI();
      });
    }

    // Seleção em Lote (Checkbox)
    if (this.chkSelectAll) {
      this.chkSelectAll.addEventListener('change', (e) => {
        const visibleNotas = this.getFilteredNotas();
        if (e.target.checked) {
          visibleNotas.forEach(n => this.selectedIds.add(n.id));
        } else {
          visibleNotas.forEach(n => this.selectedIds.delete(n.id));
        }
        this.updateBatchBar();
        this.renderTable(false);
      });
    }

    if (this.btnBatchInclude) {
      this.btnBatchInclude.addEventListener('click', () => {
        this.selectedIds.forEach(id => {
          const n = this.notas.find(x => x.id === id);
          if (n && n.statusLeitura !== 'revisao' && !n.isUnsupported) {
            n.incluidaNaSoma = true;
          }
        });
        this.updateUI();
      });
    }

    if (this.btnBatchExclude) {
      this.btnBatchExclude.addEventListener('click', () => {
        this.selectedIds.forEach(id => {
          const n = this.notas.find(x => x.id === id);
          if (n) n.incluidaNaSoma = false;
        });
        this.updateUI();
      });
    }

    if (this.btnBatchDelete) {
      this.btnBatchDelete.addEventListener('click', () => {
        if (confirm(`Deseja remover as ${this.selectedIds.size} notas selecionadas?`)) {
          this.notas = this.notas.filter(n => !this.selectedIds.has(n.id));
          this.selectedIds.clear();
          this.updateUI();
        }
      });
    }

    // Limpar Tudo
    if (this.btnClearAll) {
      this.btnClearAll.addEventListener('click', () => {
        if (this.notas.length === 0) return;
        if (this.modalConfirmClear) this.modalConfirmClear.classList.add('active');
      });
    }

    if (this.btnCancelClear) {
      this.btnCancelClear.addEventListener('click', () => {
        if (this.modalConfirmClear) this.modalConfirmClear.classList.remove('active');
      });
    }

    if (this.btnConfirmClear) {
      this.btnConfirmClear.addEventListener('click', () => {
        this.notas = [];
        this.cancellationEventsMap.clear();
        this.selectedIds.clear();
        if (this.modalConfirmClear) this.modalConfirmClear.classList.remove('active');
        this.updateUI();
      });
    }

    // Exportação
    if (this.btnExportExcel) {
      this.btnExportExcel.addEventListener('click', () => this.handleExportExcel());
    }
    if (this.btnExportPdf) {
      this.btnExportPdf.addEventListener('click', () => this.handleExportPdf());
    }

    // Botão de Demonstração
    if (this.btnLoadSamples) {
      this.btnLoadSamples.addEventListener('click', () => this.loadDemoSamples());
    }

    // Modal DANFE
    [this.btnCloseDanfe, this.btnCloseDanfeFooter].forEach(btn => {
      if (btn) btn.addEventListener('click', () => {
        if (this.modalDanfe) this.modalDanfe.classList.remove('active');
      });
    });

    if (this.btnPrintDanfe) {
      this.btnPrintDanfe.addEventListener('click', () => DanfeRenderer.print());
    }
    if (this.btnDownloadXmlOriginal) {
      this.btnDownloadXmlOriginal.addEventListener('click', () => {
        if (this.currentReviewNota) DanfeRenderer.downloadXml(this.currentReviewNota);
      });
    }

    // Modal Revisão
    [this.btnCloseReview, this.btnCancelReview].forEach(btn => {
      if (btn) btn.addEventListener('click', () => {
        if (this.modalReview) this.modalReview.classList.remove('active');
      });
    });

    if (this.btnSaveReview) {
      this.btnSaveReview.addEventListener('click', () => this.saveReviewData());
    }

    // Controles de Navegação no PDF Viewer
    if (this.btnPdfPrevPage) {
      this.btnPdfPrevPage.addEventListener('click', () => {
        if (this.currentPdfPage > 1) {
          this.currentPdfPage--;
          this.renderPdfPage();
        }
      });
    }

    if (this.btnPdfNextPage) {
      this.btnPdfNextPage.addEventListener('click', () => {
        if (this.currentPdfDoc && this.currentPdfPage < this.currentPdfDoc.numPages) {
          this.currentPdfPage++;
          this.renderPdfPage();
        }
      });
    }

    if (this.btnPdfZoomIn) {
      this.btnPdfZoomIn.addEventListener('click', () => {
        this.currentPdfScale += 0.2;
        this.renderPdfPage();
      });
    }

    if (this.btnPdfZoomOut) {
      this.btnPdfZoomOut.addEventListener('click', () => {
        if (this.currentPdfScale > 0.5) {
          this.currentPdfScale -= 0.2;
          this.renderPdfPage();
        }
      });
    }

    if (this.btnCancelProcessing) {
      this.btnCancelProcessing.addEventListener('click', () => {
        this.isProcessingCancelled = true;
      });
    }
  }

  /**
   * Processamento em Lote de Arquivos XML e PDF
   */
  async handleFileSelection(files) {
    if (!files || files.length === 0) return;

    this.isProcessingCancelled = false;
    this.modalProgress.classList.add('active');
    this.progressLog.innerHTML = '';

    const fileList = Array.from(files);
    const totalFiles = fileList.length;

    for (let i = 0; i < totalFiles; i++) {
      if (this.isProcessingCancelled) {
        this.addProgressLog('Processamento cancelado pelo usuário.', 'warn');
        break;
      }

      const file = fileList[i];
      const fileName = file.name;
      const pct = Math.round(((i + 1) / totalFiles) * 100);

      this.progressCurrentFile.textContent = `Lendo: ${fileName}`;
      this.progressCounter.textContent = `Arquivo ${i + 1} de ${totalFiles} (${pct}%)`;
      this.progressBarFill.style.width = `${pct}%`;

      try {
        const ext = fileName.split('.').pop().toLowerCase();

        if (ext === 'xml') {
          await this.processXmlFile(file);
        } else if (ext === 'pdf') {
          await this.processPdfFile(file);
        } else {
          this.addProgressLog(`${fileName}: Formato não suportado (apenas .xml e .pdf).`, 'error');
        }
      } catch (err) {
        console.error(`Erro ao processar ${fileName}:`, err);
        this.addProgressLog(`${fileName}: Erro no processamento: ${err.message}`, 'error');
      }
    }

    // Reset do input para permitir selecionar os mesmos arquivos novamente se desejado
    this.fileInput.value = '';

    setTimeout(() => {
      this.modalProgress.classList.remove('active');
      this.updateUI();
    }, 600);
  }

  /**
   * Processa arquivo XML
   */
  async processXmlFile(file) {
    const text = await file.text();
    const parsed = XmlParser.parse(text, file.name);

    if (!parsed.success) {
      if (parsed.isUnsupported) {
        // Documento fiscal não suportado (ex: CT-e ou NFS-e)
        const item = {
          id: Utils.uid(),
          numero: '-',
          serie: '-',
          dhEmi: '',
          emitente: { nome: parsed.tipoDocumento, cnpjCpf: '' },
          destinatario: { nome: '', cnpjCpf: '' },
          origem: 'XML',
          valorCents: 0,
          statusLeitura: 'nao_suportado',
          motivoRevisao: parsed.error,
          situacaoFiscal: 'nao_suportado',
          incluidaNaSoma: false,
          duplicada: false,
          isUnsupported: true,
          fileName: file.name
        };
        this.notas.push(item);
        this.addProgressLog(`${file.name}: ${parsed.error}`, 'warn');
      } else {
        this.addProgressLog(`${file.name}: Erro - ${parsed.error}`, 'error');
      }
      return;
    }

    // Se for XML de Evento de Cancelamento
    if (parsed.isEvent) {
      if (parsed.isCancellation) {
        this.cancellationEventsMap.set(parsed.chNFe, parsed);
        // Atualiza nota existente se já tiver sido importada
        const targetNota = this.notas.find(n => n.chave === parsed.chNFe);
        if (targetNota) {
          targetNota.situacaoFiscal = 'cancelada';
          targetNota.incluidaNaSoma = false;
          targetNota.motivoCancelamento = parsed.xJust || 'Cancelamento homologado';
        }
        this.addProgressLog(`${file.name}: Evento de Cancelamento registrado para a chave ${Utils.formatChave(parsed.chNFe)}.`, 'warn');
      } else {
        this.addProgressLog(`${file.name}: Evento registrado (${parsed.descEvento}).`, 'info');
      }
      return;
    }

    // Nota Fiscal Eletrônica Normal
    const notaData = {
      id: Utils.uid(),
      ...parsed
    };

    // Verificar se a nota já possui evento de cancelamento prévio
    if (this.cancellationEventsMap.has(notaData.chave)) {
      notaData.situacaoFiscal = 'cancelada';
      notaData.incluidaNaSoma = false;
      const ev = this.cancellationEventsMap.get(notaData.chave);
      notaData.motivoCancelamento = ev.xJust || 'Cancelamento homologado';
    }

    this.integrateNewNota(notaData);
    this.addProgressLog(`${file.name}: NF-e nº ${notaData.numero} importada com sucesso (R$ ${Utils.centsToNumberStr(notaData.valorCents)}).`, 'success');
  }

  /**
   * Processa arquivo PDF (incluindo multi-páginas e multi-notas)
   */
  async processPdfFile(file) {
    const extractedList = await PdfParser.parse(file, (pct, msg) => {
      if (pct !== null) this.progressBarFill.style.width = `${pct}%`;
      this.progressCurrentFile.textContent = `${file.name}: ${msg}`;
    });

    for (const extracted of extractedList) {
      if (!extracted.success && extracted.isUnsupported) {
        const item = {
          id: Utils.uid(),
          numero: '-',
          serie: '-',
          dhEmi: '',
          emitente: { nome: extracted.tipoDocumento, cnpjCpf: '' },
          destinatario: { nome: '', cnpjCpf: '' },
          origem: 'PDF',
          valorCents: 0,
          statusLeitura: 'nao_suportado',
          motivoRevisao: extracted.error,
          situacaoFiscal: 'nao_suportado',
          incluidaNaSoma: false,
          duplicada: false,
          isUnsupported: true,
          fileName: extracted.fileName,
          pdfFile: extracted.pdfFile,
          pdfUrl: extracted.pdfUrl
        };
        this.notas.push(item);
        this.addProgressLog(`${extracted.fileName}: ${extracted.error}`, 'warn');
        continue;
      }

      const notaData = {
        id: Utils.uid(),
        ...extracted
      };

      // Verificar evento de cancelamento se chave estiver disponível
      if (notaData.chave && this.cancellationEventsMap.has(notaData.chave)) {
        notaData.situacaoFiscal = 'cancelada';
        notaData.incluidaNaSoma = false;
        const ev = this.cancellationEventsMap.get(notaData.chave);
        notaData.motivoCancelamento = ev.xJust || 'Cancelamento homologado';
      }

      this.integrateNewNota(notaData);
      const valStr = Utils.centsToNumberStr(notaData.valorCents);
      const revStr = notaData.statusLeitura === 'revisao' ? ' [Revisão Necessária]' : '';
      this.addProgressLog(`${extracted.fileName}: DANFE lido (Nº ${notaData.numero}, R$ ${valStr})${revStr}.`, notaData.statusLeitura === 'revisao' ? 'warn' : 'success');
    }
  }

  /**
   * Integra uma nova nota fiscal à lista com Desduplicação Inteligente
   * Regras:
   * 1. Chave de acesso como identificador primário.
   * 2. Se importar XML e PDF da mesma nota, unir em uma única nota com origem 'XML + PDF', priorizando XML.
   * 3. Se houver divergência de valores entre XML e PDF, sinalizar para conferência.
   * 4. Se não existir chave, comparar emitente, número e série para apontar duplicidade.
   * 5. NUNCA duplicar apenas por ter o mesmo valor financeiro!
   */
  integrateNewNota(newNota) {
    if (newNota.duplicada === undefined) newNota.duplicada = false;

    // 1. Verificação por Chave de Acesso (44 dígitos)
    if (newNota.chave && newNota.chave.length === 44) {
      const existing = this.notas.find(n => n.chave === newNota.chave);

      if (existing) {
        // Se já existe um documento com a mesma chave:
        // Caso A: Um é PDF e o outro é XML (União e Associação de Documentos)
        if ((existing.origem === 'PDF' && newNota.origem === 'XML') || (existing.origem === 'XML' && newNota.origem === 'PDF')) {
          const xmlData = newNota.origem === 'XML' ? newNota : existing;
          const pdfData = newNota.origem === 'PDF' ? newNota : existing;

          // Verificar divergência de valores entre XML e PDF
          let divergencia = false;
          let divergenciaDetalhes = null;
          if (pdfData.valorCents > 0 && Math.abs(xmlData.valorCents - pdfData.valorCents) > 0) {
            divergencia = true;
            divergenciaDetalhes = `Divergência: XML aponta ${Utils.centsToBRL(xmlData.valorCents)}, mas o PDF extraiu ${Utils.centsToBRL(pdfData.valorCents)}.`;
          }

          // Atualizar o registro existente com os dados estruturados do XML mantendo o PDF associado
          Object.assign(existing, {
            ...xmlData,
            id: existing.id, // preserva ID de controle
            origem: 'XML + PDF',
            pdfFile: pdfData.pdfFile,
            pdfUrl: pdfData.pdfUrl,
            pageNumbers: pdfData.pageNumbers,
            divergencia,
            divergenciaDetalhes,
            statusLeitura: divergencia ? 'revisao' : 'sucesso',
            motivoRevisao: divergencia ? divergenciaDetalhes : null,
            incluidaNaSoma: !divergencia && (existing.incluidaNaSoma || xmlData.incluidaNaSoma)
          });
          return;
        }

        // Caso B: Mesma origem (ambos XML ou ambos PDF) -> Duplicidade real
        newNota.duplicada = true;
        newNota.incluidaNaSoma = false;
        newNota.statusLeitura = 'duplicada';
        newNota.motivoRevisao = `Duplicidade: Nota com a mesma chave de acesso já importada anteriormente.`;
        this.notas.push(newNota);
        return;
      }
    } else {
      // 2. Sem chave de acesso válida: verificar por Emitente CNPJ/CPF + Número + Série
      if (newNota.numero && newNota.numero !== '-' && newNota.emitente?.cnpjCpf) {
        const possibleDuplicate = this.notas.find(n => 
          n.numero === newNota.numero && 
          n.serie === newNota.serie && 
          n.emitente?.cnpjCpf === newNota.emitente?.cnpjCpf
        );

        if (possibleDuplicate) {
          newNota.duplicada = true;
          newNota.incluidaNaSoma = false;
          newNota.statusLeitura = 'revisao';
          newNota.motivoRevisao = `Possível duplicidade (sem chave): mesma empresa, número e série da nota já cadastrada.`;
          this.notas.push(newNota);
          return;
        }
      }
    }

    // Nota nova e única (mesmo que tenha o mesmo valor monetário de outra nota!)
    this.notas.push(newNota);
  }

  /**
   * Adiciona mensagem ao log do modal de progresso
   */
  addProgressLog(message, type = 'info') {
    const div = document.createElement('div');
    div.style.padding = '2px 0';
    if (type === 'success') div.style.color = '#15803d';
    else if (type === 'warn') div.style.color = '#b45309';
    else if (type === 'error') div.style.color = '#b91c1c';
    div.textContent = `• ${message}`;
    this.progressLog.appendChild(div);
    this.progressLog.scrollTop = this.progressLog.scrollHeight;
  }

  /**
   * Filtra notas de acordo com os filtros selecionados
   */
  getFilteredNotas() {
    return this.notas.filter(n => {
      // Busca textual
      if (this.filters.search) {
        const s = this.filters.search;
        const matchNum = n.numero && String(n.numero).toLowerCase().includes(s);
        const matchEmit = n.emitente?.nome && n.emitente.nome.toLowerCase().includes(s);
        const matchDoc = n.emitente?.cnpjCpf && n.emitente.cnpjCpf.includes(s);
        const matchChave = n.chave && n.chave.toLowerCase().includes(s);
        if (!matchNum && !matchEmit && !matchDoc && !matchChave) return false;
      }

      // Data de Emissão Inicial
      if (this.filters.dataInicio) {
        const noteDate = Utils.toISODateOnly(n.dhEmi);
        if (!noteDate || noteDate < this.filters.dataInicio) return false;
      }

      // Data de Emissão Final
      if (this.filters.dataFim) {
        const noteDate = Utils.toISODateOnly(n.dhEmi);
        if (!noteDate || noteDate > this.filters.dataFim) return false;
      }

      // Situação
      if (this.filters.situacao !== 'todas') {
        const sit = this.filters.situacao;
        if (sit === 'incluidas' && (!n.incluidaNaSoma || n.statusLeitura === 'revisao' || n.duplicada)) return false;
        if (sit === 'excluidas' && (n.incluidaNaSoma || n.duplicada || n.statusLeitura === 'revisao')) return false;
        if (sit === 'revisao' && n.statusLeitura !== 'revisao') return false;
        if (sit === 'devolucao' && !n.isDevolucao) return false;
        if (sit === 'cancelada' && n.situacaoFiscal !== 'cancelada') return false;
        if (sit === 'duplicada' && !n.duplicada) return false;
        if (sit === 'nao_suportado' && !n.isUnsupported) return false;
      }

      // Origem
      if (this.filters.origem !== 'todas') {
        if (n.origem !== this.filters.origem) return false;
      }

      // Natureza da Operação
      if (this.filters.natureza !== 'todas') {
        const nat = this.filters.natureza;
        if (nat === '__vendas__') {
          if (Utils.classificarNatureza(n.naturezaOperacao) !== 'venda') return false;
        } else if (nat === '__outras__') {
          if (Utils.classificarNatureza(n.naturezaOperacao) !== 'outras') return false;
        } else if (Utils.normalizeNatureza(n.naturezaOperacao) !== nat) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Recalcula totais e atualiza toda a interface
   */
  updateUI() {
    this.calculateTotals();
    this.renderTable();
    this.updateBatchBar();
  }

  /**
   * Cálculo de Totais Monetários com segurança de inteiros em centavos
   */
  calculateTotals() {
    // 1. Total Geral Incluído (Todas as notas elegíveis na sessão)
    let totalGeralCents = 0;
    let qtdIncluidas = 0;
    let qtdDuplicadas = 0;
    let qtdPendencias = 0;

    for (const n of this.notas) {
      if (n.duplicada) {
        qtdDuplicadas++;
      } else if (n.statusLeitura === 'revisao') {
        qtdPendencias++;
      } else if (n.incluidaNaSoma && !n.isUnsupported) {
        totalGeralCents += n.valorCents;
        qtdIncluidas++;
      }
    }

    // Atualiza os Cards
    if (this.cardTotalValor) this.cardTotalValor.textContent = Utils.centsToBRL(totalGeralCents);
    if (this.cardTotalDesc) this.cardTotalDesc.textContent = `${qtdIncluidas} nota(s) válida(s) somada(s)`;
    if (this.cardQtdIncluidas) this.cardQtdIncluidas.textContent = qtdIncluidas;
    if (this.cardQtdDuplicadas) this.cardQtdDuplicadas.textContent = qtdDuplicadas;
    if (this.cardQtdPendencias) this.cardQtdPendencias.textContent = qtdPendencias;

    if (this.lblTotalGeral) this.lblTotalGeral.textContent = `${Utils.centsToBRL(totalGeralCents)} (${qtdIncluidas} notas)`;

    this.renderNaturezaSummary();

    // 2. Subtotal Filtrado (Apenas notas visíveis com filtros ativos)
    const hasActiveFilters = Boolean(
      this.filters.search || 
      this.filters.dataInicio || 
      this.filters.dataFim || 
      this.filters.situacao !== 'todas' || 
      this.filters.origem !== 'todas' ||
      this.filters.natureza !== 'todas'
    );

    if (hasActiveFilters) {
      const filtered = this.getFilteredNotas();
      let subtotalCents = 0;
      let qtdSubtotal = 0;

      for (const n of filtered) {
        if (n.incluidaNaSoma && n.statusLeitura !== 'revisao' && !n.duplicada && !n.isUnsupported) {
          subtotalCents += n.valorCents;
          qtdSubtotal++;
        }
      }

      if (this.lblSubtotalFiltrado) this.lblSubtotalFiltrado.textContent = `${Utils.centsToBRL(subtotalCents)} (${qtdSubtotal} notas)`;
      if (this.lblSubtotalFiltradoContainer) {
        this.lblSubtotalFiltradoContainer.style.display = 'inline-block';
        this.lblSubtotalFiltradoContainer.classList.add('active-filter');
      }
    } else {
      if (this.lblSubtotalFiltradoContainer) this.lblSubtotalFiltradoContainer.style.display = 'none';
    }
  }

  /**
   * Agrupa as notas incluídas na soma por Natureza da Operação
   * @returns {{grupos: Array, vendasCents: number, vendasQtd: number}}
   */
  getNaturezaSummary(notas = this.notas) {
    const map = new Map();
    let vendasCents = 0;
    let vendasQtd = 0;
    for (const n of notas) {
      if (!n.incluidaNaSoma || n.statusLeitura === 'revisao' || n.duplicada || n.isUnsupported) continue;
      const key = Utils.normalizeNatureza(n.naturezaOperacao);
      const tipo = Utils.classificarNatureza(key);
      if (!map.has(key)) map.set(key, { natureza: key, tipo, qtd: 0, cents: 0 });
      const g = map.get(key);
      g.qtd++;
      g.cents += n.valorCents;
      if (tipo === 'venda') {
        vendasCents += n.valorCents;
        vendasQtd++;
      }
    }
    const grupos = [...map.values()].sort((a, b) =>
      (a.tipo === b.tipo ? 0 : (a.tipo === 'venda' ? -1 : 1)) || (b.cents - a.cents));
    return { grupos, vendasCents, vendasQtd };
  }

  /**
   * Renderiza o painel de soma por Natureza da Operação
   */
  renderNaturezaSummary() {
    const { grupos, vendasCents, vendasQtd } = this.getNaturezaSummary();

    if (this.lblTotalVendas) this.lblTotalVendas.textContent = Utils.centsToBRL(vendasCents);
    if (this.lblTotalVendasDesc) this.lblTotalVendasDesc.textContent = `${vendasQtd} nota(s) de venda`;

    // Atualiza opções do filtro de natureza preservando a seleção
    if (this.filterNatureza) {
      const fixed = `
        <option value="todas">Todas as Naturezas</option>
        <option value="__vendas__">Somente Vendas</option>
        <option value="__outras__">Somente Outras (não venda)</option>`;
      const naturezas = [...new Set(this.notas.map(n => Utils.normalizeNatureza(n.naturezaOperacao)))].sort();
      this.filterNatureza.innerHTML = fixed + naturezas
        .map(nat => `<option value="${Utils.escapeHtml(nat)}">${Utils.escapeHtml(nat)}</option>`).join('');
      this.filterNatureza.value = this.filters.natureza;
      if (this.filterNatureza.value !== this.filters.natureza) {
        this.filters.natureza = 'todas';
        this.filterNatureza.value = 'todas';
      }
    }

    if (!this.naturezaTableBody) return;
    if (grupos.length === 0) {
      this.naturezaTableBody.innerHTML = `<tr><td colspan="4" class="text-center" style="color: var(--text-muted); padding: 1rem;">Nenhuma nota incluída na soma.</td></tr>`;
      return;
    }

    const outras = grupos.filter(g => g.tipo !== 'venda');
    const outrasCents = outras.reduce((s, g) => s + g.cents, 0);
    const outrasQtd = outras.reduce((s, g) => s + g.qtd, 0);
    const activeCls = v => (this.filters.natureza === v ? ' active' : '');

    this.naturezaTableBody.innerHTML = grupos.map(g => {
      const badge = g.tipo === 'venda'
        ? '<span class="badge badge-success">Venda</span>'
        : (g.natureza === 'NÃO IDENTIFICADA'
          ? '<span class="badge badge-warning" title="Natureza não encontrada no PDF. Abra a nota em Revisar e informe a natureza.">Verificar</span>'
          : '<span class="badge badge-neutral">Outras</span>');
      return `
        <tr class="natureza-row natureza-${g.tipo}${activeCls(g.natureza)}" data-natureza="${Utils.escapeHtml(g.natureza)}" title="Clique para filtrar a tabela por esta natureza">
          <td>${Utils.escapeHtml(g.natureza)}</td>
          <td>${badge}</td>
          <td style="text-align: center;">${g.qtd}</td>
          <td class="col-valor">${Utils.centsToBRL(g.cents)}</td>
        </tr>`;
    }).join('') + `
        <tr class="natureza-row natureza-total natureza-total-venda${activeCls('__vendas__')}" data-natureza="__vendas__" title="Clique para filtrar somente vendas">
          <td colspan="2">Subtotal Vendas</td>
          <td style="text-align: center;">${vendasQtd}</td>
          <td class="col-valor">${Utils.centsToBRL(vendasCents)}</td>
        </tr>
        <tr class="natureza-row natureza-total${activeCls('__outras__')}" data-natureza="__outras__" title="Clique para filtrar somente outras operações">
          <td colspan="2">Subtotal Outras Operações</td>
          <td style="text-align: center;">${outrasQtd}</td>
          <td class="col-valor">${Utils.centsToBRL(outrasCents)}</td>
        </tr>`;
  }

  /**
   * Renderiza a tabela de notas
   */
  renderTable(resetCheckAll = true) {
    if (!this.tableBody) return;
    const filteredNotas = this.getFilteredNotas();

    if (this.notas.length === 0) {
      this.emptyState.style.display = 'block';
      this.tableBody.innerHTML = '';
      if (resetCheckAll) this.chkSelectAll.checked = false;
      return;
    }

    this.emptyState.style.display = 'none';

    if (filteredNotas.length === 0) {
      this.tableBody.innerHTML = `
        <tr>
          <td colspan="12" class="text-center" style="padding: 2.5rem; color: var(--text-muted);">
            Nenhuma nota encontrada com os filtros selecionados.
          </td>
        </tr>
      `;
      if (resetCheckAll) this.chkSelectAll.checked = false;
      return;
    }

    const html = filteredNotas.map(n => {
      const isSelected = this.selectedIds.has(n.id);
      let rowClass = '';
      if (n.duplicada) rowClass = 'row-duplicate';
      else if (n.statusLeitura === 'revisao') rowClass = 'row-review';
      else if (!n.incluidaNaSoma) rowClass = 'row-excluded';

      // Badge Origem
      let badgeOrigemClass = 'badge-origin-xml';
      if (n.origem === 'PDF') badgeOrigemClass = 'badge-origin-pdf';
      else if (n.origem === 'XML + PDF') badgeOrigemClass = 'badge-origin-both';

      // Badges de Situação Fiscal e Leitura
      let situacaoBadges = '';
      if (n.isUnsupported) {
        situacaoBadges += `<span class="badge badge-danger">Não Suportado</span> `;
      } else if (n.duplicada) {
        situacaoBadges += `<span class="badge badge-neutral">Duplicada</span> `;
      } else if (n.situacaoFiscal === 'cancelada') {
        situacaoBadges += `<span class="badge badge-danger">Cancelada por Evento</span> `;
      } else if (n.isDevolucao) {
        situacaoBadges += `<span class="badge badge-info">Devolução (Somada)</span> `;
      } else {
        situacaoBadges += `<span class="badge badge-success">Normal</span> `;
      }

      if (n.statusLeitura === 'revisao') {
        situacaoBadges += `<span class="badge badge-warning" title="${Utils.escapeHtml(n.motivoRevisao || 'Conferência necessária')}">Revisão Necessária</span> `;
      }

      if (n.divergencia) {
        situacaoBadges += `<span class="badge badge-danger" title="${Utils.escapeHtml(n.divergenciaDetalhes || 'Valores divergentes')}">Divergência XML vs PDF</span> `;
      }

      if (n.editadoManualmente) {
        situacaoBadges += `<span class="badge badge-info" title="Dados alterados manualmente pelo usuário">Editado Manualmente</span> `;
      }

      // Botões de Ação
      const canViewDanfe = Boolean(n.rawXml);
      const canViewPdf = Boolean(n.pdfUrl);

      return `
        <tr class="${rowClass}" data-id="${n.id}">
          <td>
            <input type="checkbox" class="row-checkbox" data-id="${n.id}" ${isSelected ? 'checked' : ''}>
          </td>
          <td><strong>${Utils.escapeHtml(n.numero)}</strong></td>
          <td>${Utils.escapeHtml(n.serie)}</td>
          <td>${Utils.formatDate(n.dhEmi)}</td>
          <td title="${Utils.escapeHtml(n.emitente?.nome || '')}">
            ${Utils.escapeHtml((n.emitente?.nome || '-').substring(0, 32))}
          </td>
          <td>${Utils.formatCnpjCpf(n.emitente?.cnpjCpf)}</td>
          <td title="${Utils.escapeHtml(n.naturezaOperacao || '')}">
            ${Utils.escapeHtml(Utils.normalizeNatureza(n.naturezaOperacao).substring(0, 30))}
          </td>
          <td><span class="badge ${badgeOrigemClass}">${n.origem}</span></td>
          <td>${situacaoBadges}</td>
          <td class="col-valor">${Utils.centsToBRL(n.valorCents)}</td>
          <td style="text-align: center;">
            <label class="toggle-switch" title="${n.incluidaNaSoma ? 'Incluída no cálculo' : 'Excluída do cálculo'}">
              <input type="checkbox" class="toggle-incluir" data-id="${n.id}" ${n.incluidaNaSoma ? 'checked' : ''} ${n.isUnsupported || n.statusLeitura === 'revisao' ? 'disabled' : ''}>
              <span class="toggle-slider"></span>
            </label>
          </td>
          <td class="col-actions">
            ${canViewDanfe ? `
              <button type="button" class="btn btn-secondary btn-sm btn-danfe" data-id="${n.id}" title="Visualizar DANFE Oficial a partir do XML">
                DANFE
              </button>
            ` : ''}
            <button type="button" class="btn btn-secondary btn-sm btn-review" data-id="${n.id}" title="Revisar e conferir dados ao lado do documento original">
              ${canViewPdf ? 'PDF / Revisar' : 'Revisar'}
            </button>
            <button type="button" class="btn btn-danger btn-sm btn-delete" data-id="${n.id}" title="Remover Nota">
              &times;
            </button>
          </td>
        </tr>
      `;
    }).join('');

    this.tableBody.innerHTML = html;

    // Vincular Eventos das Linhas
    this.tableBody.querySelectorAll('.row-checkbox').forEach(chk => {
      chk.addEventListener('change', (e) => {
        const id = e.target.dataset.id;
        if (e.target.checked) this.selectedIds.add(id);
        else this.selectedIds.delete(id);
        this.updateBatchBar();
      });
    });

    this.tableBody.querySelectorAll('.toggle-incluir').forEach(chk => {
      chk.addEventListener('change', (e) => {
        const id = e.target.dataset.id;
        const nota = this.notas.find(x => x.id === id);
        if (nota) {
          nota.incluidaNaSoma = e.target.checked;
          this.updateUI();
        }
      });
    });

    this.tableBody.querySelectorAll('.btn-danfe').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        this.openDanfeModal(id);
      });
    });

    this.tableBody.querySelectorAll('.btn-review').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        this.openReviewModal(id);
      });
    });

    this.tableBody.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        this.deleteNota(id);
      });
    });

    if (resetCheckAll) {
      const allSelected = filteredNotas.length > 0 && filteredNotas.every(n => this.selectedIds.has(n.id));
      this.chkSelectAll.checked = allSelected;
    }
  }

  /**
   * Atualiza barra de ações em lote
   */
  updateBatchBar() {
    if (!this.batchActionsBar) return;
    const count = this.selectedIds.size;
    if (count > 0) {
      this.batchActionsBar.style.display = 'flex';
      if (this.batchSelectedCount) this.batchSelectedCount.textContent = count;
    } else {
      this.batchActionsBar.style.display = 'none';
    }
  }

  /**
   * Remove uma nota individualmente
   */
  deleteNota(id) {
    const nota = this.notas.find(n => n.id === id);
    if (!nota) return;
    if (confirm(`Deseja remover a nota nº ${nota.numero} (${Utils.centsToBRL(nota.valorCents)})?`)) {
      this.notas = this.notas.filter(n => n.id !== id);
      this.selectedIds.delete(id);
      this.updateUI();
    }
  }

  /**
   * Abre o Modal de Visualização de DANFE
   */
  openDanfeModal(id) {
    const nota = this.notas.find(n => n.id === id);
    if (!nota) return;
    this.currentReviewNota = nota;
    DanfeRenderer.render(nota, this.danfeModalBody);
    this.modalDanfe.classList.add('active');
  }

  /**
   * Abre o Modal de Revisão Lado a Lado
   */
  async openReviewModal(id) {
    const nota = this.notas.find(n => n.id === id);
    if (!nota) return;

    this.currentReviewNota = nota;

    // Preencher campos do formulário
    this.editValorTotal.value = Utils.centsToNumberStr(nota.valorCents);
    this.editChave.value = Utils.formatChave(nota.chave);
    this.editNumero.value = nota.numero || '';
    this.editSerie.value = nota.serie || '1';
    this.editDataEmissao.value = Utils.toISODateOnly(nota.dhEmi);
    this.editEmitenteNome.value = nota.emitente?.nome || '';
    this.editEmitenteCnpj.value = Utils.formatCnpjCpf(nota.emitente?.cnpjCpf || '');
    this.editDestinatarioNome.value = nota.destinatario?.nome || '';
    if (this.editNatureza) this.editNatureza.value = nota.naturezaOperacao || '';
    this.editIncluirSoma.checked = nota.incluidaNaSoma;

    // Aviso de conferência
    if (nota.statusLeitura === 'revisao') {
      this.reviewNoticeBox.innerHTML = `<strong>Atenção (Revisão Necessária):</strong> ${Utils.escapeHtml(nota.motivoRevisao || 'Verifique o valor e dados da nota.')}`;
      this.reviewNoticeBox.style.display = 'block';
    } else if (nota.divergencia) {
      this.reviewNoticeBox.innerHTML = `<strong>Atenção (Divergência XML vs PDF):</strong> ${Utils.escapeHtml(nota.divergenciaDetalhes)}`;
      this.reviewNoticeBox.style.display = 'block';
    } else {
      this.reviewNoticeBox.innerHTML = `<strong>Conferência:</strong> Você pode ajustar qualquer campo. A edição manual será registrada no histórico.`;
      this.reviewNoticeBox.style.display = 'block';
    }

    this.modalReview.classList.add('active');

    // Carregar PDF no visualizador se disponível
    if (nota.pdfFile) {
      try {
        const arrayBuffer = await nota.pdfFile.arrayBuffer();
        this.currentPdfDoc = await window.pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
        this.currentPdfPage = (nota.pageNumbers && nota.pageNumbers[0]) ? nota.pageNumbers[0] : 1;
        this.currentPdfScale = 1.0;
        this.renderPdfPage();
      } catch (err) {
        console.warn('Não foi possível carregar PDF para visualização lado a lado:', err);
      }
    } else {
      // Se não possui PDF original (importado apenas via XML)
      const ctx = this.pdfViewerCanvas.getContext('2d');
      this.pdfViewerCanvas.width = 400;
      this.pdfViewerCanvas.height = 300;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 400, 300);
      ctx.fillStyle = '#64748b';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Esta nota foi importada via XML.', 200, 140);
      ctx.fillText('Para ver o DANFE gráfico, use o botão "DANFE".', 200, 165);
      this.pdfPageIndicator.textContent = 'XML Original';
    }
  }

  /**
   * Renderiza a página do PDF no canvas da revisão
   */
  async renderPdfPage() {
    if (!this.currentPdfDoc) return;
    try {
      const page = await this.currentPdfDoc.getPage(this.currentPdfPage);
      const viewport = page.getViewport({ scale: this.currentPdfScale });
      this.pdfViewerCanvas.width = viewport.width;
      this.pdfViewerCanvas.height = viewport.height;
      const ctx = this.pdfViewerCanvas.getContext('2d');

      await page.render({
        canvasContext: ctx,
        viewport: viewport
      }).promise;

      this.pdfPageIndicator.textContent = `Pág ${this.currentPdfPage} / ${this.currentPdfDoc.numPages}`;
    } catch (e) {
      console.warn('Erro ao renderizar página do PDF:', e);
    }
  }

  /**
   * Salva dados editados / conferidos na revisão
   */
  saveReviewData() {
    if (!this.currentReviewNota) return;

    const valorCents = Utils.parseMoneyToCents(this.editValorTotal.value);
    if (isNaN(valorCents) || valorCents < 0) {
      alert('Por favor, informe um Valor Total válido para a nota.');
      return;
    }

    const chaveLimpa = Utils.cleanChave(this.editChave.value);

    // Atualiza nota
    this.currentReviewNota.valorCents = valorCents;
    this.currentReviewNota.chave = chaveLimpa;
    this.currentReviewNota.numero = this.editNumero.value.trim() || '-';
    this.currentReviewNota.serie = this.editSerie.value.trim() || '1';
    this.currentReviewNota.dhEmi = this.editDataEmissao.value || this.currentReviewNota.dhEmi;
    this.currentReviewNota.emitente.nome = this.editEmitenteNome.value.trim();
    this.currentReviewNota.emitente.cnpjCpf = Utils.cleanChave(this.editEmitenteCnpj.value);
    this.currentReviewNota.destinatario.nome = this.editDestinatarioNome.value.trim();
    if (this.editNatureza) this.currentReviewNota.naturezaOperacao = this.editNatureza.value.trim().toUpperCase();
    this.currentReviewNota.incluidaNaSoma = this.editIncluirSoma.checked;

    // Registra que foi editada manualmente e retira da pendência
    this.currentReviewNota.editadoManualmente = true;
    this.currentReviewNota.statusLeitura = 'sucesso';
    this.currentReviewNota.motivoRevisao = null;
    this.currentReviewNota.divergencia = false;

    this.modalReview.classList.remove('active');
    this.updateUI();
  }

  /**
   * Exporta dados para Excel
   */
  handleExportExcel() {
    if (this.notas.length === 0) {
      alert('Nenhuma nota importada para exportar.');
      return;
    }

    const hasFilters = Boolean(
      this.filters.search || 
      this.filters.dataInicio || 
      this.filters.dataFim || 
      this.filters.situacao !== 'todas' || 
      this.filters.origem !== 'todas' ||
      this.filters.natureza !== 'todas'
    );

    let notasToExport = this.notas;
    let escopo = 'Todas as notas importadas';

    if (hasFilters) {
      const choose = confirm('Filtros estão ativos!\n\nClique OK para exportar apenas as notas visíveis no filtro atual.\nClique Cancelar para exportar todas as notas cadastradas.');
      if (choose) {
        notasToExport = this.getFilteredNotas();
        escopo = 'Notas visíveis com filtro aplicado';
      }
    }

    ExportService.exportToExcel(notasToExport, { escopo });
  }

  /**
   * Exporta relatório para PDF
   */
  handleExportPdf() {
    if (this.notas.length === 0) {
      alert('Nenhuma nota importada para gerar relatório.');
      return;
    }

    const hasFilters = Boolean(
      this.filters.search || 
      this.filters.dataInicio || 
      this.filters.dataFim || 
      this.filters.situacao !== 'todas' || 
      this.filters.origem !== 'todas' ||
      this.filters.natureza !== 'todas'
    );

    let notasToExport = this.notas;
    let escopo = 'Todas as notas importadas';

    if (hasFilters) {
      const choose = confirm('Filtros estão ativos!\n\nClique OK para gerar relatório com as notas filtradas visíveis.\nClique Cancelar para gerar relatório completo com todas as notas.');
      if (choose) {
        notasToExport = this.getFilteredNotas();
        escopo = 'Notas visíveis com filtro aplicado';
      }
    }

    ExportService.exportToPdf(notasToExport, { escopo });
  }

  /**
   * Carrega os arquivos reais de demonstração criados na pasta samples/
   */
  async loadDemoSamples() {
    const sampleFiles = [
      { path: 'samples/NFe_35230912345678000195550010000010011000010014.xml', type: 'xml' },
      { path: 'samples/DANFE_1001.pdf', type: 'pdf' },
      { path: 'samples/DANFE_4004_PDF_exclusivo.pdf', type: 'pdf' },
      { path: 'samples/DANFE_5005_multipage.pdf', type: 'pdf' },
      { path: 'samples/NFe_35230911223344000155550010000030031000030037.xml', type: 'xml' },
      { path: 'samples/NFe_35230998765432000188550010000020021000020020.xml', type: 'xml' },
      { path: 'samples/Evento_Cancelamento_35230998765432000188550010000020021000020020.xml', type: 'xml' },
      { path: 'samples/DANFE_sem_total_revisao.pdf', type: 'pdf' },
      { path: 'samples/CTe_invalido_35230912345678000195570010000010011000010014.xml', type: 'xml' },
      { path: 'samples/NFSe_invalida.xml', type: 'xml' }
    ];

    this.modalProgress.classList.add('active');
    this.progressLog.innerHTML = '';
    this.progressBarFill.style.width = '0%';

    for (let i = 0; i < sampleFiles.length; i++) {
      const item = sampleFiles[i];
      const fileName = item.path.split('/').pop();
      const pct = Math.round(((i + 1) / sampleFiles.length) * 100);

      this.progressCurrentFile.textContent = `Carregando exemplo: ${fileName}`;
      this.progressCounter.textContent = `Demonstração ${i + 1} de ${sampleFiles.length}`;
      this.progressBarFill.style.width = `${pct}%`;

      try {
        const resp = await fetch(item.path);
        if (!resp.ok) throw new Error(`Status ${resp.status}`);
        
        if (item.type === 'xml') {
          const text = await resp.text();
          const fakeFile = new File([text], fileName, { type: 'application/xml' });
          await this.processXmlFile(fakeFile);
        } else {
          const blob = await resp.blob();
          const fakeFile = new File([blob], fileName, { type: 'application/pdf' });
          await this.processPdfFile(fakeFile);
        }
      } catch (err) {
        this.addProgressLog(`${fileName}: Falha ao carregar exemplo (${err.message}).`, 'warn');
      }
    }

    setTimeout(() => {
      this.modalProgress.classList.remove('active');
      this.updateUI();
    }, 500);
  }
}

// Inicializa a aplicação ao carregar o DOM
document.addEventListener('DOMContentLoaded', () => {
  window.app = new SomadorApp();
});
