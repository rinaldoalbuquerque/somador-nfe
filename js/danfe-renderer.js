/**
 * Somador de Notas - Renderizador Oficial de DANFE (NF-e Modelo 55)
 * Gera a representação gráfica fidedigna do DANFE a partir dos dados do XML.
 * Permite visualização em tela, impressão nativa A4 e download em PDF.
 */

const DanfeRenderer = {
  /**
   * Renderiza o HTML do DANFE dentro de um container
   * @param {Object} nota Dados da nota extraídos do XML
   * @param {HTMLElement} container Elemento onde o DANFE será injetado
   */
  render(nota, container) {
    if (!nota || !nota.rawXml) {
      container.innerHTML = `
        <div class="danfe-error">
          <h3>Dados Insuficientes para DANFE</h3>
          <p>Esta nota não possui o XML estruturado original necessário para gerar a representação gráfica do DANFE.</p>
        </div>
      `;
      return;
    }

    // Se for nota importada apenas por PDF, explicar
    if (nota.origem === 'PDF' && !nota.rawXml) {
      container.innerHTML = `
        <div class="danfe-error">
          <h3>Nota Importada via PDF</h3>
          <p>Esta nota foi importada diretamente a partir de um arquivo PDF digital/escaneado. Para visualizar o documento original, utilize o botão "Visualizar PDF Original".</p>
        </div>
      `;
      return;
    }

    const e = Utils.escapeHtml;
    const emit = nota.emitente || {};
    const dest = nota.destinatario || {};
    const endEmit = emit.endereco || {};
    const endDest = dest.endereco || {};
    const totais = nota.totais || {};
    const itens = nota.itens || [];
    const chaveFormatada = Utils.formatChave(nota.chave);

    const fmtMoney = (v) => {
      if (!v && v !== 0) return '0,00';
      const cents = Utils.parseMoneyToCents(String(v));
      return Utils.centsToNumberStr(cents);
    };

    const html = `
      <div class="danfe-document" id="danfe-print-area">
        <!-- CANHOTO DE RECEBIMENTO -->
        <div class="danfe-canhoto">
          <div class="danfe-canhoto-recibo">
            RECEBEMOS DE <strong>${e(emit.nome)}</strong> OS PRODUTOS/SERVIÇOS CONSTANTES DA NOTA FISCAL INDICADA AO LADO.
            <div class="danfe-canhoto-assinatura">
              <div class="canhoto-campo"><label>DATA DE RECEBIMENTO</label><span></span></div>
              <div class="canhoto-campo"><label>IDENTIFICAÇÃO E ASSINATURA DO RECEBEDOR</label><span></span></div>
            </div>
          </div>
          <div class="danfe-canhoto-numero">
            <div class="canhoto-nfe-title">NF-e</div>
            <div class="canhoto-nfe-num">Nº ${e(nota.numero)}</div>
            <div class="canhoto-nfe-serie">SÉRIE ${e(nota.serie)}</div>
          </div>
        </div>

        <div class="danfe-divider-dashed"></div>

        <!-- CABEÇALHO DO DANFE -->
        <div class="danfe-header-grid">
          <!-- DADOS DO EMITENTE -->
          <div class="danfe-box danfe-emitente-box">
            <div class="emitente-nome">${e(emit.nome)}</div>
            <div class="emitente-dados">
              ${e(endEmit.logradouro || '')} ${e(endEmit.numero ? ', ' + endEmit.numero : '')} ${e(endEmit.complemento ? ' - ' + endEmit.complemento : '')}<br>
              ${e(endEmit.bairro || '')} - CEP: ${e(endEmit.cep || '')}<br>
              ${e(endEmit.municipio || '')} - ${e(endEmit.uf || '')} - Fone: ${e(endEmit.telefone || '')}
            </div>
          </div>

          <!-- IDENTIFICAÇÃO DO DANFE -->
          <div class="danfe-box danfe-tipo-box">
            <div class="danfe-title">DANFE</div>
            <div class="danfe-subtitle">DOCUMENTO AUXILIAR DA NOTA FISCAL ELETRÔNICA</div>
            <div class="danfe-tp-indicador">
              <span class="tp-box">${nota.tpNF === 'Entrada' ? '0' : '1'}</span>
              <span class="tp-desc">0 - Entrada<br>1 - Saída</span>
            </div>
            <div class="danfe-numero-serie">
              <strong>Nº ${e(nota.numero)}</strong><br>
              SÉRIE ${e(nota.serie)}<br>
              FOLHA 1/1
            </div>
          </div>

          <!-- CÓDIGO DE BARRAS E CHAVE DE ACESSO -->
          <div class="danfe-box danfe-chave-box">
            <div class="danfe-barcode-container">
              <svg id="danfe-barcode-svg"></svg>
            </div>
            <div class="danfe-chave-label">CHAVE DE ACESSO</div>
            <div class="danfe-chave-value">${chaveFormatada}</div>
            <div class="danfe-consulta-txt">
              Consulta de autenticidade no portal nacional da NF-e<br>
              www.nfe.fazenda.gov.br/portal ou no site da Sefaz Autorizadora
            </div>
          </div>
        </div>

        <!-- NATUREZA DA OPERAÇÃO E INSCRIÇÕES -->
        <div class="danfe-row-grid grid-col-2">
          <div class="danfe-box">
            <label>NATUREZA DA OPERAÇÃO</label>
            <div class="field-value">${e(nota.naturezaOperacao || 'VENDA')}</div>
          </div>
          <div class="danfe-box">
            <label>PROTOCOLO DE AUTORIZAÇÃO DE USO</label>
            <div class="field-value">
              ${e(nota.protocolo ? `${nota.protocolo.nProt} - ${Utils.formatDate(nota.protocolo.dhRecbto, true)}` : 'Documento em contingência ou sem protocolo anexado')}
            </div>
          </div>
        </div>

        <div class="danfe-row-grid grid-col-3">
          <div class="danfe-box">
            <label>INSCRIÇÃO ESTADUAL</label>
            <div class="field-value">${e(emit.ie || '-')}</div>
          </div>
          <div class="danfe-box">
            <label>INSCRIÇÃO ESTADUAL DO SUBST. TRIB.</label>
            <div class="field-value">-</div>
          </div>
          <div class="danfe-box">
            <label>CNPJ / CPF DO EMITENTE</label>
            <div class="field-value">${Utils.formatCnpjCpf(emit.cnpjCpf)}</div>
          </div>
        </div>

        <!-- DESTINATÁRIO / REMETENTE -->
        <div class="danfe-section-header">DESTINATÁRIO / REMETENTE</div>
        <div class="danfe-row-grid grid-col-dest-1">
          <div class="danfe-box">
            <label>NOME / RAZÃO SOCIAL</label>
            <div class="field-value">${e(dest.nome || 'Não informado')}</div>
          </div>
          <div class="danfe-box">
            <label>CNPJ / CPF</label>
            <div class="field-value">${Utils.formatCnpjCpf(dest.cnpjCpf)}</div>
          </div>
          <div class="danfe-box">
            <label>DATA DE EMISSÃO</label>
            <div class="field-value">${Utils.formatDate(nota.dhEmi)}</div>
          </div>
        </div>

        <div class="danfe-row-grid grid-col-dest-2">
          <div class="danfe-box">
            <label>ENDEREÇO</label>
            <div class="field-value">${e(endDest.logradouro || '')} ${e(endDest.numero ? ', ' + endDest.numero : '')}</div>
          </div>
          <div class="danfe-box">
            <label>BAIRRO / DISTRITO</label>
            <div class="field-value">${e(endDest.bairro || '-')}</div>
          </div>
          <div class="danfe-box">
            <label>CEP</label>
            <div class="field-value">${e(endDest.cep || '-')}</div>
          </div>
          <div class="danfe-box">
            <label>DATA DA ENTRADA / SAÍDA</label>
            <div class="field-value">${Utils.formatDate(nota.dhEmi)}</div>
          </div>
        </div>

        <div class="danfe-row-grid grid-col-dest-3">
          <div class="danfe-box">
            <label>MUNICÍPIO</label>
            <div class="field-value">${e(endDest.municipio || '-')}</div>
          </div>
          <div class="danfe-box">
            <label>FONE / FAX</label>
            <div class="field-value">${e(endDest.telefone || '-')}</div>
          </div>
          <div class="danfe-box">
            <label>UF</label>
            <div class="field-value">${e(endDest.uf || '-')}</div>
          </div>
          <div class="danfe-box">
            <label>INSCRIÇÃO ESTADUAL</label>
            <div class="field-value">${e(dest.ie || '-')}</div>
          </div>
        </div>

        <!-- CÁLCULO DO IMPOSTO -->
        <div class="danfe-section-header">CÁLCULO DO IMPOSTO</div>
        <div class="danfe-row-grid grid-col-5">
          <div class="danfe-box">
            <label>BASE DE CÁLCULO DO ICMS</label>
            <div class="field-value text-right">${fmtMoney(totais.vBC)}</div>
          </div>
          <div class="danfe-box">
            <label>VALOR DO ICMS</label>
            <div class="field-value text-right">${fmtMoney(totais.vICMS)}</div>
          </div>
          <div class="danfe-box">
            <label>BASE DE CÁLC. ICMS S.T.</label>
            <div class="field-value text-right">${fmtMoney(totais.vBCST)}</div>
          </div>
          <div class="danfe-box">
            <label>VALOR DO ICMS SUBST.</label>
            <div class="field-value text-right">${fmtMoney(totais.vST)}</div>
          </div>
          <div class="danfe-box">
            <label>VALOR TOTAL DOS PRODUTOS</label>
            <div class="field-value text-right">${fmtMoney(totais.vProd)}</div>
          </div>
        </div>

        <div class="danfe-row-grid grid-col-6">
          <div class="danfe-box">
            <label>VALOR DO FRETE</label>
            <div class="field-value text-right">${fmtMoney(totais.vFrete)}</div>
          </div>
          <div class="danfe-box">
            <label>VALOR DO SEGURO</label>
            <div class="field-value text-right">${fmtMoney(totais.vSeg)}</div>
          </div>
          <div class="danfe-box">
            <label>DESCONTO</label>
            <div class="field-value text-right">${fmtMoney(totais.vDesc)}</div>
          </div>
          <div class="danfe-box">
            <label>OUTRAS DESPESAS</label>
            <div class="field-value text-right">${fmtMoney(totais.vOutro)}</div>
          </div>
          <div class="danfe-box">
            <label>VALOR DO IPI</label>
            <div class="field-value text-right">${fmtMoney(totais.vIPI)}</div>
          </div>
          <div class="danfe-box danfe-box-destaque">
            <label>VALOR TOTAL DA NOTA</label>
            <div class="field-value text-right text-bold">${Utils.centsToBRL(nota.valorCents)}</div>
          </div>
        </div>

        <!-- DADOS DOS PRODUTOS / SERVIÇOS -->
        <div class="danfe-section-header">DADOS DOS PRODUTOS / SERVIÇOS</div>
        <div class="danfe-table-wrapper">
          <table class="danfe-itens-table">
            <thead>
              <tr>
                <th style="width: 8%;">CÓDIGO</th>
                <th style="width: 32%;">DESCRIÇÃO DOS PRODUTOS / SERVIÇOS</th>
                <th style="width: 8%;">NCM/SH</th>
                <th style="width: 6%;">CST</th>
                <th style="width: 6%;">CFOP</th>
                <th style="width: 5%;">UN</th>
                <th style="width: 7%;">QTD</th>
                <th style="width: 8%;">V. UNIT</th>
                <th style="width: 8%;">V. TOTAL</th>
                <th style="width: 6%;">BC ICMS</th>
                <th style="width: 6%;">V. ICMS</th>
              </tr>
            </thead>
            <tbody>
              ${itens.length > 0 ? itens.map(it => `
                <tr>
                  <td>${e(it.cProd)}</td>
                  <td class="text-left">${e(it.xProd)}</td>
                  <td>${e(it.NCM)}</td>
                  <td>${e(it.cst || '-')}</td>
                  <td>${e(it.CFOP)}</td>
                  <td>${e(it.uCom)}</td>
                  <td class="text-right">${e(it.qCom)}</td>
                  <td class="text-right">${fmtMoney(it.vUnCom)}</td>
                  <td class="text-right">${fmtMoney(it.vProd)}</td>
                  <td class="text-right">${fmtMoney(it.vBC)}</td>
                  <td class="text-right">${fmtMoney(it.vICMS)}</td>
                </tr>
              `).join('') : `
                <tr>
                  <td colspan="11" class="text-center">Nenhum item discriminado no XML.</td>
                </tr>
              `}
            </tbody>
          </table>
        </div>

        <!-- DADOS ADICIONAIS -->
        <div class="danfe-section-header">DADOS ADICIONAIS</div>
        <div class="danfe-row-grid grid-col-2">
          <div class="danfe-box danfe-box-infcpl">
            <label>INFORMAÇÕES COMPLEMENTARES</label>
            <div class="field-value-pre">${e(nota.informacoesComplementares || 'Nenhuma informação complementar informada.')}</div>
          </div>
          <div class="danfe-box danfe-box-fisco">
            <label>RESERVADO AO FISCO</label>
            <div class="field-value-pre">${e(nota.informacoesFisco || '')}</div>
          </div>
        </div>
      </div>
    `;

    container.innerHTML = html;

    // Renderizar código de barras Code128
    if (window.JsBarcode && nota.chave && nota.chave.length === 44) {
      try {
        window.JsBarcode('#danfe-barcode-svg', nota.chave, {
          format: 'CODE128',
          width: 1.1,
          height: 38,
          displayValue: false,
          margin: 0
        });
      } catch (err) {
        console.warn('Falha ao renderizar código de barras do DANFE:', err);
      }
    }
  },

  /**
   * Dispara a impressão do DANFE renderizado
   */
  print() {
    window.print();
  },

  /**
   * Faz o download do XML original associado
   * @param {Object} nota
   */
  downloadXml(nota) {
    if (!nota || !nota.rawXml) {
      alert('Arquivo XML original não disponível.');
      return;
    }
    const blob = new Blob([nota.rawXml], { type: 'application/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NFe_${nota.chave || nota.numero}.xml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
};
