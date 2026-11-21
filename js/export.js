/**
 * Somador de Notas - Motor de Exportação
 * Gera planilhas Excel (.xlsx) completas com SheetJS e relatórios PDF de auditoria com jsPDF.
 * Separa notas incluídas, duplicidades, pendências e excluídas, identificando o escopo (Geral vs Filtrado).
 */

const ExportService = {
  /**
   * Agrupa notas incluídas por Natureza da Operação
   */
  groupByNatureza(incluidas) {
    const map = new Map();
    for (const n of incluidas) {
      const key = Utils.normalizeNatureza(n.naturezaOperacao);
      if (!map.has(key)) map.set(key, { natureza: key, tipo: Utils.classificarNatureza(key), qtd: 0, cents: 0 });
      const g = map.get(key);
      g.qtd++;
      g.cents += n.valorCents;
    }
    const grupos = [...map.values()].sort((a, b) =>
      (a.tipo === b.tipo ? 0 : (a.tipo === 'venda' ? -1 : 1)) || (b.cents - a.cents));
    const vendas = grupos.filter(g => g.tipo === 'venda');
    const outras = grupos.filter(g => g.tipo !== 'venda');
    return {
      grupos,
      vendasCents: vendas.reduce((t, g) => t + g.cents, 0),
      vendasQtd: vendas.reduce((t, g) => t + g.qtd, 0),
      outrasCents: outras.reduce((t, g) => t + g.cents, 0),
      outrasQtd: outras.reduce((t, g) => t + g.qtd, 0)
    };
  },

  /**
   * Exporta a relação de notas e apuração para arquivo Excel (.xlsx)
   * @param {Array<Object>} notas Lista de notas a exportar (todas ou filtradas)
   * @param {Object} metadata { escopo: 'Todas as notas' | 'Filtradas', dataGeracao: Date, totalCents: number }
   */
  exportToExcel(notas, metadata = {}) {
    if (!window.XLSX) {
      alert('Biblioteca SheetJS (XLSX) não encontrada.');
      return;
    }

    const wb = window.XLSX.utils.book_new();

    // 1. Separar notas incluídas e outras categorias
    const incluidas = notas.filter(n => n.incluidaNaSoma && n.statusLeitura !== 'revisao' && !n.duplicada);
    const pendencias = notas.filter(n => n.statusLeitura === 'revisao' || n.duplicada || !n.incluidaNaSoma || n.isUnsupported);

    // Formatar linhas para Notas Incluídas
    const rowsIncluidas = incluidas.map(n => ({
      'Número': n.numero,
      'Série': n.serie,
      'Data Emissão': Utils.formatDate(n.dhEmi),
      'Chave de Acesso': Utils.formatChave(n.chave),
      'Emitente': n.emitente?.nome || '-',
      'CNPJ/CPF Emitente': Utils.formatCnpjCpf(n.emitente?.cnpjCpf),
      'Destinatário': n.destinatario?.nome || '-',
      'Natureza da Operação': Utils.normalizeNatureza(n.naturezaOperacao),
      'Tipo': Utils.classificarNatureza(n.naturezaOperacao) === 'venda' ? 'Venda' : 'Outras',
      'Origem': n.origem,
      'Situação Fiscal': n.isDevolucao ? 'Devolução (Somada)' : (n.situacaoFiscal === 'cancelada' ? 'Cancelada' : 'Normal'),
      'Valor (R$)': n.valorCents / 100
    }));

    // Linha de total para notas incluídas
    const totalIncluidoCents = incluidas.reduce((sum, n) => sum + n.valorCents, 0);
    rowsIncluidas.push({
      'Número': 'TOTAL',
      'Série': '',
      'Data Emissão': '',
      'Chave de Acesso': '',
      'Emitente': '',
      'CNPJ/CPF Emitente': '',
      'Destinatário': '',
      'Natureza da Operação': '',
      'Tipo': '',
      'Origem': '',
      'Situação Fiscal': `${incluidas.length} nota(s) incluída(s)`,
      'Valor (R$)': totalIncluidoCents / 100
    });

    const wsIncluidas = window.XLSX.utils.json_to_sheet(rowsIncluidas);

    // Ajuste de largura das colunas
    wsIncluidas['!cols'] = [
      { wch: 10 }, // Número
      { wch: 8 },  // Série
      { wch: 14 }, // Data Emissão
      { wch: 50 }, // Chave de Acesso
      { wch: 35 }, // Emitente
      { wch: 20 }, // CNPJ
      { wch: 30 }, // Destinatário
      { wch: 40 }, // Natureza da Operação
      { wch: 10 }, // Tipo
      { wch: 12 }, // Origem
      { wch: 20 }, // Situação Fiscal
      { wch: 15 }  // Valor
    ];

    window.XLSX.utils.book_append_sheet(wb, wsIncluidas, 'Notas Incluídas');

    // 1b. Aba de Soma por Natureza da Operação
    const nat = this.groupByNatureza(incluidas);
    const rowsNatureza = nat.grupos.map(g => ({
      'Natureza da Operação': g.natureza,
      'Tipo': g.tipo === 'venda' ? 'Venda' : 'Outras',
      'Qtd. Notas': g.qtd,
      'Valor (R$)': g.cents / 100
    }));
    rowsNatureza.push({ 'Natureza da Operação': 'SUBTOTAL VENDAS (base para impostos)', 'Tipo': '', 'Qtd. Notas': nat.vendasQtd, 'Valor (R$)': nat.vendasCents / 100 });
    rowsNatureza.push({ 'Natureza da Operação': 'SUBTOTAL OUTRAS OPERAÇÕES', 'Tipo': '', 'Qtd. Notas': nat.outrasQtd, 'Valor (R$)': nat.outrasCents / 100 });
    rowsNatureza.push({ 'Natureza da Operação': 'TOTAL GERAL', 'Tipo': '', 'Qtd. Notas': incluidas.length, 'Valor (R$)': totalIncluidoCents / 100 });
    const wsNatureza = window.XLSX.utils.json_to_sheet(rowsNatureza);
    wsNatureza['!cols'] = [{ wch: 50 }, { wch: 10 }, { wch: 12 }, { wch: 16 }];
    window.XLSX.utils.book_append_sheet(wb, wsNatureza, 'Por Natureza');

    // 2. Aba de Pendências e Excluídas (se houver)
    if (pendencias.length > 0) {
      const rowsPendencias = pendencias.map(n => {
        let motivo = 'Excluída manualmente da soma';
        if (n.duplicada) motivo = 'Duplicidade identificada (chave ou dados repetidos)';
        else if (n.statusLeitura === 'revisao') motivo = n.motivoRevisao || 'Leitura incerta - Requer revisão';
        else if (n.isUnsupported) motivo = 'Documento não suportado (ex: NFS-e ou CT-e)';
        else if (n.situacaoFiscal === 'cancelada') motivo = 'Nota cancelada por evento';

        return {
          'Número': n.numero,
          'Série': n.serie,
          'Data Emissão': Utils.formatDate(n.dhEmi),
          'Chave de Acesso': Utils.formatChave(n.chave),
          'Emitente': n.emitente?.nome || '-',
          'Origem': n.origem,
          'Motivo da Não Inclusão': motivo,
          'Valor Identificado (R$)': (n.valorCents || 0) / 100
        };
      });

      const wsPendencias = window.XLSX.utils.json_to_sheet(rowsPendencias);
      wsPendencias['!cols'] = [
        { wch: 10 }, { wch: 8 }, { wch: 14 }, { wch: 50 }, { wch: 35 }, { wch: 12 }, { wch: 45 }, { wch: 18 }
      ];
      window.XLSX.utils.book_append_sheet(wb, wsPendencias, 'Excluídas e Pendências');
    }

    // 3. Aba de Resumo
    const resumoData = [
      { 'Item': 'Sistema', 'Valor': 'Somador de Notas - Conferência Fiscal' },
      { 'Item': 'Data e Hora da Geração', 'Valor': new Date().toLocaleString('pt-BR') },
      { 'Item': 'Escopo da Exportação', 'Valor': metadata.escopo || 'Todas as notas importadas' },
      { 'Item': 'Total Geral das Notas Incluídas', 'Valor': Utils.centsToBRL(totalIncluidoCents) },
      { 'Item': 'Total de Vendas (base para impostos)', 'Valor': `${Utils.centsToBRL(nat.vendasCents)} (${nat.vendasQtd} nota(s))` },
      { 'Item': 'Total de Outras Operações (não venda)', 'Valor': `${Utils.centsToBRL(nat.outrasCents)} (${nat.outrasQtd} nota(s))` },
      { 'Item': 'Quantidade de Notas Incluídas', 'Valor': incluidas.length },
      { 'Item': 'Quantidade de Duplicidades Desconsideradas', 'Valor': notas.filter(n => n.duplicada).length },
      { 'Item': 'Quantidade de Pendências em Revisão', 'Valor': notas.filter(n => n.statusLeitura === 'revisao').length },
      { 'Item': 'Quantidade de Notas Excluídas', 'Valor': notas.filter(n => !n.incluidaNaSoma && !n.duplicada && n.statusLeitura !== 'revisao').length },
      { 'Item': 'Regra de Devoluções', 'Valor': 'Devoluções são somadas ao montante geral das notas incluídas (não subtraídas)' },
      { 'Item': 'Consulta SEFAZ', 'Valor': 'A situação atual na SEFAZ não é consultada nesta versão' }
    ];
    const wsResumo = window.XLSX.utils.json_to_sheet(resumoData);
    wsResumo['!cols'] = [{ wch: 35 }, { wch: 60 }];
    window.XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo da Apuração');

    // Gravar e baixar
    const dateStr = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    window.XLSX.writeFile(wb, `Somador_de_Notas_${dateStr}.xlsx`);
  },

  /**
   * Exporta relatório fiscal auditável em PDF com jsPDF e AutoTable
   * @param {Array<Object>} notas Lista de notas
   * @param {Object} metadata Metadados do relatório
   */
  exportToPdf(notas, metadata = {}) {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      alert('Biblioteca jsPDF não encontrada.');
      return;
    }

    const doc = new window.jspdf.jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const incluidas = notas.filter(n => n.incluidaNaSoma && n.statusLeitura !== 'revisao' && !n.duplicada);
    const pendencias = notas.filter(n => n.statusLeitura === 'revisao' || n.duplicada || !n.incluidaNaSoma || n.isUnsupported);
    const totalIncluidoCents = incluidas.reduce((sum, n) => sum + n.valorCents, 0);

    const now = new Date().toLocaleString('pt-BR');
    const escopo = metadata.escopo || 'Todas as notas importadas';

    // Cabeçalho Principal (Azul Marinho)
    doc.setFillColor(15, 43, 92); // #0f2b5c
    doc.rect(0, 0, 210, 28, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('SOMADOR DE NOTAS', 14, 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Relatório Oficial de Apuração e Conferência de NF-e', 14, 18);
    doc.text(`Gerado em: ${now} | Escopo: ${escopo}`, 14, 23);

    // Caixa de Destaque do Total Incluído (Verde Esmeralda)
    doc.setFillColor(240, 253, 244);
    doc.setDrawColor(16, 185, 129);
    doc.roundedRect(14, 33, 182, 22, 2, 2, 'FD');

    doc.setTextColor(15, 43, 92);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('VALOR TOTAL DAS NOTAS INCLUÍDAS NA SOMA:', 20, 41);

    doc.setTextColor(5, 150, 105);
    doc.setFontSize(18);
    doc.text(Utils.centsToBRL(totalIncluidoCents), 20, 50);

    doc.setTextColor(80, 80, 80);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`${incluidas.length} nota(s) somada(s) | ${pendencias.length} pendente(s) ou excluída(s)`, 120, 50);

    const nat = this.groupByNatureza(incluidas);
    doc.setTextColor(5, 150, 105);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(`Total de Vendas (base p/ impostos): ${Utils.centsToBRL(nat.vendasCents)}`, 120, 41);

    // Tabela de Notas Incluídas
    doc.setTextColor(15, 43, 92);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('1. Soma por Natureza da Operação', 14, 62);

    doc.autoTable({
      startY: 65,
      head: [['Natureza da Operação', 'Tipo', 'Qtd.', 'Valor']],
      body: nat.grupos.map(g => [g.natureza, g.tipo === 'venda' ? 'Venda' : 'Outras', g.qtd, Utils.centsToBRL(g.cents)]),
      foot: [
        ['SUBTOTAL VENDAS (base para impostos)', '', nat.vendasQtd, Utils.centsToBRL(nat.vendasCents)],
        ['SUBTOTAL OUTRAS OPERAÇÕES', '', nat.outrasQtd, Utils.centsToBRL(nat.outrasCents)]
      ],
      theme: 'striped',
      headStyles: { fillColor: [15, 43, 92], textColor: 255, fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8, textColor: 40 },
      footStyles: { fillColor: [236, 253, 245], textColor: [5, 150, 105], fontSize: 8.5, fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 110 },
        1: { cellWidth: 20 },
        2: { cellWidth: 17, halign: 'center' },
        3: { cellWidth: 35, halign: 'right', fontStyle: 'bold' }
      },
      margin: { left: 14, right: 14 }
    });

    let relY = doc.lastAutoTable.finalY + 10;
    if (relY > 250) {
      doc.addPage();
      relY = 20;
    }
    doc.setTextColor(15, 43, 92);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('2. Relação das Notas Fiscais Incluídas no Total', 14, relY);

    const tableData = incluidas.map(n => [
      n.numero,
      n.serie,
      Utils.formatDate(n.dhEmi),
      (n.emitente?.nome || '-').substring(0, 26),
      Utils.formatCnpjCpf(n.emitente?.cnpjCpf),
      Utils.normalizeNatureza(n.naturezaOperacao).substring(0, 28),
      n.isDevolucao ? 'Devolução' : (n.situacaoFiscal === 'cancelada' ? 'Cancelada' : 'Normal'),
      Utils.centsToBRL(n.valorCents)
    ]);

    doc.autoTable({
      startY: relY + 3,
      head: [['Nº', 'Série', 'Emissão', 'Emitente', 'CNPJ/CPF', 'Natureza', 'Situação', 'Valor']],
      body: tableData,
      theme: 'striped',
      headStyles: {
        fillColor: [15, 43, 92],
        textColor: 255,
        fontSize: 8,
        fontStyle: 'bold'
      },
      bodyStyles: {
        fontSize: 7.5,
        textColor: 40
      },
      columnStyles: {
        0: { cellWidth: 15 },
        1: { cellWidth: 12 },
        2: { cellWidth: 18 },
        3: { cellWidth: 36 },
        4: { cellWidth: 26 },
        5: { cellWidth: 32 },
        6: { cellWidth: 17 },
        7: { cellWidth: 26, halign: 'right', fontStyle: 'bold' }
      },
      footStyles: {
        fillColor: [15, 43, 92],
        textColor: [255, 255, 255],
        fontSize: 9,
        fontStyle: 'bold'
      },
      foot: [[
        { content: 'TOTAL GERAL APURADO:', colSpan: 7, styles: { halign: 'right', fontStyle: 'bold', textColor: [255, 255, 255] } },
        { content: Utils.centsToBRL(totalIncluidoCents), styles: { halign: 'right', fontStyle: 'bold', textColor: [255, 255, 255], fontSize: 9.5 } }
      ]],
      margin: { left: 14, right: 14 }
    });

    // Se houver pendências ou excluídas, adicionar seção dedicada
    if (pendencias.length > 0) {
      let finalY = doc.lastAutoTable.finalY + 10;
      if (finalY > 240) {
        doc.addPage();
        finalY = 20;
      }

      doc.setTextColor(180, 40, 40);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('3. Notas Excluídas, Duplicidades e Pendências de Revisão', 14, finalY);

      const pendenciasData = pendencias.map(n => {
        let motivo = 'Excluída manualmente';
        if (n.duplicada) motivo = 'Duplicidade desconsiderada';
        else if (n.statusLeitura === 'revisao') motivo = n.motivoRevisao || 'Revisão necessária';
        else if (n.isUnsupported) motivo = 'Documento não suportado';
        else if (n.situacaoFiscal === 'cancelada') motivo = 'Cancelada por evento';

        return [
          n.numero,
          n.serie,
          Utils.formatDate(n.dhEmi),
          (n.emitente?.nome || '-').substring(0, 25),
          n.origem,
          motivo,
          Utils.centsToBRL(n.valorCents || 0)
        ];
      });

      doc.autoTable({
        startY: finalY + 4,
        head: [['Nº', 'Série', 'Emissão', 'Emitente', 'Origem', 'Motivo / Situação', 'Valor']],
        body: pendenciasData,
        theme: 'plain',
        headStyles: {
          fillColor: [220, 38, 38],
          textColor: 255,
          fontSize: 8,
          fontStyle: 'bold'
        },
        bodyStyles: {
          fontSize: 7.5,
          textColor: 60
        },
        columnStyles: {
          0: { cellWidth: 15 },
          1: { cellWidth: 12 },
          2: { cellWidth: 18 },
          3: { cellWidth: 40 },
          4: { cellWidth: 15 },
          5: { cellWidth: 50 },
          6: { cellWidth: 28, halign: 'right' }
        },
        margin: { left: 14, right: 14 }
      });
    }

    // Rodapés com numeração de páginas
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7.5);
      doc.setTextColor(130);
      doc.text(
        `Somador de Notas - Processamento Seguro no Navegador | Página ${i} de ${pageCount}`,
        14,
        290
      );
      doc.text(
        'Regra: Devoluções somadas. Situação SEFAZ não consultada.',
        135,
        290
      );
    }

    const dateStr = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    doc.save(`Relatorio_Somador_de_Notas_${dateStr}.pdf`);
  }
};
