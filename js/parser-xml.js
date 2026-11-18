/**
 * Somador de Notas - Parser de Arquivos XML de NF-e e Eventos
 * Suporta NF-e modelo 55 com ou sem envelope nfeProc e com namespaces.
 * Identifica documentos não suportados (NFS-e, CT-e, NFC-e, etc.) e eventos de cancelamento.
 */

const XmlParser = {
  /**
   * Helper para buscar elementos pelo localName ignorando namespaces
   */
  findNode(parent, localName) {
    if (!parent) return null;
    const directChildren = parent.children;
    for (let i = 0; i < directChildren.length; i++) {
      if (directChildren[i].localName === localName) {
        return directChildren[i];
      }
    }
    // Busca em profundidade se não encontrou nos filhos imediatos
    const all = parent.getElementsByTagName('*');
    for (let i = 0; i < all.length; i++) {
      if (all[i].localName === localName) {
        return all[i];
      }
    }
    return null;
  },

  /**
   * Helper para buscar todos os elementos por localName
   */
  findAllNodes(parent, localName) {
    if (!parent) return [];
    const result = [];
    const all = parent.getElementsByTagName('*');
    for (let i = 0; i < all.length; i++) {
      if (all[i].localName === localName) {
        result.push(all[i]);
      }
    }
    return result;
  },

  /**
   * Helper para extrair texto de uma tag filha
   */
  getText(parent, localName) {
    const node = this.findNode(parent, localName);
    return node ? node.textContent.trim() : '';
  },

  /**
   * Analisa o conteúdo de uma string XML
   * @param {string} xmlString Conteúdo do arquivo
   * @param {string} fileName Nome original do arquivo
   * @returns {Object} Resultado da análise
   */
  parse(xmlString, fileName = 'nota.xml') {
    if (!xmlString || typeof xmlString !== 'string') {
      return {
        success: false,
        fileName,
        error: 'Arquivo vazio ou formato inválido.'
      };
    }

    let xmlDoc;
    try {
      const parser = new DOMParser();
      xmlDoc = parser.parseFromString(xmlString, 'text/xml');
      const parseError = xmlDoc.getElementsByTagName('parsererror');
      if (parseError.length > 0) {
        return {
          success: false,
          fileName,
          error: 'XML malformatado ou corrompido: ' + parseError[0].textContent.substring(0, 150)
        };
      }
    } catch (e) {
      return {
        success: false,
        fileName,
        error: 'Falha ao processar a estrutura XML: ' + e.message
      };
    }

    const root = xmlDoc.documentElement;
    const rootName = root.localName;

    // 1. Identificar Documentos Não Suportados (CT-e, NFS-e, MDF-e, CF-e)
    if (rootName === 'cteProc' || rootName === 'CTe' || this.findNode(root, 'infCte')) {
      return {
        success: false,
        isUnsupported: true,
        tipoDocumento: 'CT-e',
        fileName,
        error: 'Conhecimento de Transporte Eletrônico (CT-e) não é suportado nesta versão. Apenas NF-e (modelo 55) é aceita.'
      };
    }

    if (rootName === 'CompNfse' || rootName === 'GerarNfseResposta' || rootName === 'ConsultarNfseResposta' || this.findNode(root, 'InfNfse') || this.findNode(root, 'Rps')) {
      return {
        success: false,
        isUnsupported: true,
        tipoDocumento: 'NFS-e',
        fileName,
        error: 'Nota Fiscal de Serviços Eletrônica (NFS-e) não é suportada nesta versão. Apenas NF-e (modelo 55) é aceita.'
      };
    }

    if (rootName === 'CFe' || rootName === 'cfeProc' || this.findNode(root, 'infCFe')) {
      return {
        success: false,
        isUnsupported: true,
        tipoDocumento: 'CF-e / SAT',
        fileName,
        error: 'Cupom Fiscal Eletrônico (CF-e / SAT) não é suportado nesta versão.'
      };
    }

    if (rootName === 'mdfeProc' || rootName === 'MDFe' || this.findNode(root, 'infMDFe')) {
      return {
        success: false,
        isUnsupported: true,
        tipoDocumento: 'MDF-e',
        fileName,
        error: 'Manifesto de Documentos Fiscais Eletrônicos (MDF-e) não é suportado nesta versão.'
      };
    }

    // 2. Identificar XMLs de Eventos (Cancelamento, CC-e, etc.)
    if (rootName === 'procEventoNFe' || rootName === 'evento' || rootName === 'retEvento' || this.findNode(root, 'infEvento')) {
      return this.parseEvent(root, xmlString, fileName);
    }

    // 3. Localizar tag NFe e infNFe
    let nfeNode = (rootName === 'NFe') ? root : this.findNode(root, 'NFe');
    if (!nfeNode) {
      return {
        success: false,
        fileName,
        error: 'Elemento <NFe> não encontrado. O arquivo não é uma NF-e válida.'
      };
    }

    const infNFe = this.findNode(nfeNode, 'infNFe');
    if (!infNFe) {
      return {
        success: false,
        fileName,
        error: 'Elemento <infNFe> ausente no documento.'
      };
    }

    // Dados de Identificação (ide)
    const ide = this.findNode(infNFe, 'ide');
    if (!ide) {
      return {
        success: false,
        fileName,
        error: 'Elemento <ide> ausente no documento.'
      };
    }

    // Verificar modelo (apenas modelo 55 é suportado)
    const modelo = this.getText(ide, 'mod');
    if (modelo && modelo !== '55') {
      return {
        success: false,
        isUnsupported: true,
        tipoDocumento: `Modelo ${modelo}`,
        fileName,
        error: `Documento fiscal modelo ${modelo} (ex: NFC-e mod. 65) não é suportado. Esta versão aceita exclusivamente NF-e (modelo 55).`
      };
    }

    const numero = this.getText(ide, 'nNF');
    const serie = this.getText(ide, 'serie');
    const dhEmi = this.getText(ide, 'dhEmi') || this.getText(ide, 'dEmi');
    const natOp = this.getText(ide, 'natOp');
    const tpNF = this.getText(ide, 'tpNF'); // 0 = Entrada, 1 = Saída
    const finNFe = this.getText(ide, 'finNFe'); // 1 = Normal, 2 = Complementar, 3 = Ajuste, 4 = Devolução

    // Chave de acesso: extraída do atributo Id de infNFe (sem o prefixo 'NFe') ou de protNFe/infProt/chNFe
    let chave = '';
    const idAttr = infNFe.getAttribute('Id');
    if (idAttr) {
      chave = Utils.cleanChave(idAttr.replace(/^NFe/i, ''));
    }
    if (!chave || chave.length !== 44) {
      const protNFe = this.findNode(root, 'protNFe');
      if (protNFe) {
        chave = Utils.cleanChave(this.getText(protNFe, 'chNFe'));
      }
    }

    // Emitente (emit)
    const emit = this.findNode(infNFe, 'emit');
    const emitNome = emit ? (this.getText(emit, 'xNome') || this.getText(emit, 'xFant')) : '';
    const emitCnpj = emit ? this.getText(emit, 'CNPJ') : '';
    const emitCpf = emit ? this.getText(emit, 'CPF') : '';
    const emitDoc = emitCnpj || emitCpf;
    const emitIE = emit ? this.getText(emit, 'IE') : '';
    const enderEmit = emit ? this.findNode(emit, 'enderEmit') : null;
    const emitEndereco = enderEmit ? {
      logradouro: this.getText(enderEmit, 'xLgr'),
      numero: this.getText(enderEmit, 'nro'),
      complemento: this.getText(enderEmit, 'xCpl'),
      bairro: this.getText(enderEmit, 'xBairro'),
      municipio: this.getText(enderEmit, 'xMun'),
      uf: this.getText(enderEmit, 'UF'),
      cep: this.getText(enderEmit, 'CEP'),
      telefone: this.getText(enderEmit, 'fone')
    } : null;

    // Destinatário (dest)
    const dest = this.findNode(infNFe, 'dest');
    const destNome = dest ? (this.getText(dest, 'xNome') || this.getText(dest, 'xFant')) : '';
    const destCnpj = dest ? this.getText(dest, 'CNPJ') : '';
    const destCpf = dest ? this.getText(dest, 'CPF') : '';
    const destDoc = destCnpj || destCpf;
    const destIE = dest ? this.getText(dest, 'IE') : '';
    const enderDest = dest ? this.findNode(dest, 'enderDest') : null;
    const destEndereco = enderDest ? {
      logradouro: this.getText(enderDest, 'xLgr'),
      numero: this.getText(enderDest, 'nro'),
      complemento: this.getText(enderDest, 'xCpl'),
      bairro: this.getText(enderDest, 'xBairro'),
      municipio: this.getText(enderDest, 'xMun'),
      uf: this.getText(enderDest, 'UF'),
      cep: this.getText(enderDest, 'CEP'),
      telefone: this.getText(enderDest, 'fone')
    } : null;

    // Totais: O ESCOPO EXIGE ESPECIFICAMENTE total/ICMSTot/vNF
    const totalNode = this.findNode(infNFe, 'total');
    const icmsTot = totalNode ? this.findNode(totalNode, 'ICMSTot') : null;

    if (!icmsTot) {
      return {
        success: false,
        fileName,
        error: 'Grupo <total><ICMSTot> não encontrado na NF-e.'
      };
    }

    const vNFStr = this.getText(icmsTot, 'vNF');
    if (!vNFStr) {
      return {
        success: false,
        fileName,
        error: 'Campo <vNF> (Valor Total da Nota) não encontrado no grupo <ICMSTot>.'
      };
    }

    const valorCents = Utils.parseMoneyToCents(vNFStr);

    // Extrair demais totais fiscais para DANFE completa
    const totais = {
      vBC: this.getText(icmsTot, 'vBC'),
      vICMS: this.getText(icmsTot, 'vICMS'),
      vBCST: this.getText(icmsTot, 'vBCST'),
      vST: this.getText(icmsTot, 'vST'),
      vProd: this.getText(icmsTot, 'vProd'),
      vFrete: this.getText(icmsTot, 'vFrete'),
      vSeg: this.getText(icmsTot, 'vSeg'),
      vDesc: this.getText(icmsTot, 'vDesc'),
      vII: this.getText(icmsTot, 'vII'),
      vIPI: this.getText(icmsTot, 'vIPI'),
      vPIS: this.getText(icmsTot, 'vPIS'),
      vCOFINS: this.getText(icmsTot, 'vCOFINS'),
      vOutro: this.getText(icmsTot, 'vOutro'),
      vNF: vNFStr
    };

    // Protocolo de Autorização
    const protNFe = this.findNode(root, 'protNFe');
    let protocolo = null;
    if (protNFe) {
      protocolo = {
        nProt: this.getText(protNFe, 'nProt'),
        dhRecbto: this.getText(protNFe, 'dhRecbto'),
        cStat: this.getText(protNFe, 'cStat'),
        xMotivo: this.getText(protNFe, 'xMotivo')
      };
    }

    // Itens (det)
    const detNodes = this.findAllNodes(infNFe, 'det');
    const itens = [];
    for (const det of detNodes) {
      const prod = this.findNode(det, 'prod');
      const imposto = this.findNode(det, 'imposto');
      const icms = imposto ? this.findNode(imposto, 'ICMS') : null;
      let cst = '';
      let vBC = '';
      let pICMS = '';
      let vICMS = '';
      if (icms && icms.firstElementChild) {
        cst = this.getText(icms.firstElementChild, 'CST') || this.getText(icms.firstElementChild, 'CSOSN');
        vBC = this.getText(icms.firstElementChild, 'vBC');
        pICMS = this.getText(icms.firstElementChild, 'pICMS');
        vICMS = this.getText(icms.firstElementChild, 'vICMS');
      }

      itens.push({
        nItem: det.getAttribute('nItem') || (itens.length + 1),
        cProd: prod ? this.getText(prod, 'cProd') : '',
        xProd: prod ? this.getText(prod, 'xProd') : '',
        NCM: prod ? this.getText(prod, 'NCM') : '',
        CFOP: prod ? this.getText(prod, 'CFOP') : '',
        uCom: prod ? this.getText(prod, 'uCom') : '',
        qCom: prod ? this.getText(prod, 'qCom') : '',
        vUnCom: prod ? this.getText(prod, 'vUnCom') : '',
        vProd: prod ? this.getText(prod, 'vProd') : '',
        cst,
        vBC,
        pICMS,
        vICMS
      });
    }

    // Informações Adicionais
    const infAdic = this.findNode(infNFe, 'infAdic');
    const infCpl = infAdic ? this.getText(infAdic, 'infCpl') : '';
    const infAdFisco = infAdic ? this.getText(infAdic, 'infAdFisco') : '';

    // Situação Fiscal Inicial
    const isDevolucao = finNFe === '4' || (natOp && natOp.toUpperCase().includes('DEVOLU'));
    const situacaoFiscal = isDevolucao ? 'devolucao' : 'normal';

    return {
      success: true,
      fileName,
      origem: 'XML',
      chave,
      numero: numero || '-',
      serie: serie || '1',
      dhEmi: dhEmi || '',
      naturezaOperacao: natOp,
      tpNF: tpNF === '0' ? 'Entrada' : 'Saída',
      finNFe,
      isDevolucao,
      emitente: {
        nome: emitNome || 'Emitente não informado',
        cnpjCpf: emitDoc,
        ie: emitIE,
        endereco: emitEndereco
      },
      destinatario: {
        nome: destNome || 'Destinatário não informado',
        cnpjCpf: destDoc,
        ie: destIE,
        endereco: destEndereco
      },
      totais,
      valorCents,
      protocolo,
      itens,
      informacoesComplementares: infCpl,
      informacoesFisco: infAdFisco,
      rawXml: xmlString,
      statusLeitura: 'sucesso',
      situacaoFiscal,
      incluidaNaSoma: true,
      editadoManualmente: false,
      duplicada: false,
      divergencia: false,
      divergenciaDetalhes: null
    };
  },

  /**
   * Processa XML de Evento de NF-e (Cancelamento, etc.)
   */
  parseEvent(root, xmlString, fileName) {
    const infEvento = this.findNode(root, 'infEvento');
    const tpEvento = this.getText(infEvento || root, 'tpEvento');
    const descEvento = this.getText(infEvento || root, 'descEvento') || this.getText(root, 'xEvento');
    const chNFe = Utils.cleanChave(this.getText(infEvento || root, 'chNFe'));
    const dhEvento = this.getText(infEvento || root, 'dhEvento') || this.getText(root, 'dhRegEvento');
    const xJust = this.getText(infEvento || root, 'xJust');
    const nProt = this.getText(infEvento || root, 'nProt');

    const isCancellation = (tpEvento === '110111' || (descEvento && descEvento.toLowerCase().includes('cancel')));

    return {
      success: true,
      isEvent: true,
      isCancellation,
      tpEvento,
      descEvento: descEvento || (isCancellation ? 'Cancelamento' : 'Evento de NF-e'),
      chNFe,
      dhEvento,
      xJust,
      nProt,
      fileName,
      rawXml: xmlString
    };
  }
};
