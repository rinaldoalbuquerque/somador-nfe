/**
 * Somador de Notas - Utilitários de Precisão, Formatação e Validação
 * Todas as operações monetárias utilizam inteiros em centavos para evitar erros de ponto flutuante.
 */

const Utils = {
  /**
   * Converte centavos inteiros para string monetária formatada em Real (ex: R$ 1.234,56)
   * @param {number|bigint} cents
   * @returns {string}
   */
  centsToBRL(cents) {
    if (cents === null || cents === undefined || isNaN(cents)) return 'R$ 0,00';
    const num = Number(cents);
    const isNegative = num < 0;
    const abs = Math.abs(num);
    const intPart = Math.floor(abs / 100);
    const decPart = String(abs % 100).padStart(2, '0');
    
    // Formata milhares com ponto
    const formattedInt = String(intPart).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `${isNegative ? '-' : ''}R$ ${formattedInt},${decPart}`;
  },

  /**
   * Converte centavos para string numérica formatada (ex: 1.234,56)
   * @param {number|bigint} cents
   * @returns {string}
   */
  centsToNumberStr(cents) {
    if (cents === null || cents === undefined || isNaN(cents)) return '0,00';
    const num = Number(cents);
    const isNegative = num < 0;
    const abs = Math.abs(num);
    const intPart = Math.floor(abs / 100);
    const decPart = String(abs % 100).padStart(2, '0');
    const formattedInt = String(intPart).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `${isNegative ? '-' : ''}${formattedInt},${decPart}`;
  },

  /**
   * Converte texto monetário ou numérico (pt-BR ou en-US) para inteiro de centavos
   * Suporta: "1.234,56", "1234,56", "1234.56", "R$ 1.234,56", " 4520.80 "
   * @param {string|number} val
   * @returns {number} Centavos inteiros
   */
  parseMoneyToCents(val) {
    if (typeof val === 'number') {
      if (isNaN(val)) return 0;
      return Math.round(val * 100);
    }
    if (!val || typeof val !== 'string') return 0;
    
    let str = val.trim().replace(/^R\$\s*/i, '').trim();
    if (!str) return 0;

    let isNegative = false;
    if (str.startsWith('-')) {
      isNegative = true;
      str = str.substring(1).trim();
    }

    // Identificar separador decimal
    // Caso padrão Brasil: 1.234,56 ou 1234,56
    if (str.includes(',')) {
      // Remove pontos de milhares
      str = str.replace(/\./g, '');
      const parts = str.split(',');
      const intPart = parts[0] ? parts[0].replace(/\D/g, '') : '0';
      const decPart = parts[1] ? parts[1].replace(/\D/g, '').padEnd(2, '0').slice(0, 2) : '00';
      const cents = parseInt(intPart || '0', 10) * 100 + parseInt(decPart || '0', 10);
      return isNegative ? -cents : cents;
    } else if (str.includes('.')) {
      // Caso XML ou internacional: 1234.56 ou 1,234.56
      // Se houver mais de um ponto ou vírgulas misturadas:
      if ((str.match(/\./g) || []).length === 1 && !str.includes(',')) {
        const parts = str.split('.');
        const intPart = parts[0] ? parts[0].replace(/\D/g, '') : '0';
        const decPart = parts[1] ? parts[1].replace(/\D/g, '').padEnd(2, '0').slice(0, 2) : '00';
        const cents = parseInt(intPart || '0', 10) * 100 + parseInt(decPart || '0', 10);
        return isNegative ? -cents : cents;
      } else {
        // Múltiplos pontos podem ser separador de milhar pt-BR sem decimais (ex: "1.234")
        const clean = str.replace(/\D/g, '');
        const cents = parseInt(clean || '0', 10) * 100;
        return isNegative ? -cents : cents;
      }
    } else {
      // Apenas dígitos
      const clean = str.replace(/\D/g, '');
      const cents = parseInt(clean || '0', 10) * 100;
      return isNegative ? -cents : cents;
    }
  },

  /**
   * Limpa chave de acesso para conter apenas 44 dígitos
   * @param {string} chave
   * @returns {string}
   */
  cleanChave(chave) {
    if (!chave) return '';
    return String(chave).replace(/\D/g, '').trim();
  },

  /**
   * Formata chave de acesso em 11 grupos de 4 dígitos
   * @param {string} chave
   * @returns {string}
   */
  formatChave(chave) {
    const clean = this.cleanChave(chave);
    if (!clean || clean.length !== 44) return chave || '-';
    return clean.replace(/(\d{4})(?=\d)/g, '$1 ');
  },

  /**
   * Valida dígito verificador da Chave de Acesso da NF-e (Módulo 11)
   * @param {string} chave 44 dígitos
   * @returns {boolean}
   */
  isValidChave(chave) {
    const clean = this.cleanChave(chave);
    if (clean.length !== 44) return false;

    const base = clean.slice(0, 43);
    const dvOriginal = parseInt(clean[43], 10);

    let soma = 0;
    let peso = 2;
    for (let i = base.length - 1; i >= 0; i--) {
      soma += parseInt(base[i], 10) * peso;
      peso++;
      if (peso > 9) peso = 2;
    }

    const resto = soma % 11;
    const dvCalculado = (resto === 0 || resto === 1) ? 0 : (11 - resto);

    return dvCalculado === dvOriginal;
  },

  /**
   * Formata CNPJ (14 dígitos) ou CPF (11 dígitos)
   * @param {string} doc
   * @returns {string}
   */
  formatCnpjCpf(doc) {
    if (!doc) return '-';
    const clean = String(doc).replace(/\D/g, '');
    if (clean.length === 14) {
      return clean.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
    }
    if (clean.length === 11) {
      return clean.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
    }
    return doc;
  },

  /**
   * Formata data/hora ISO ou YYYY-MM-DD para DD/MM/YYYY ou DD/MM/YYYY HH:mm
   * @param {string} dateStr
   * @param {boolean} includeTime
   * @returns {string}
   */
  formatDate(dateStr, includeTime = false) {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) {
        // Tenta regex YYYY-MM-DD
        const m = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (m) {
          return `${m[3]}/${m[2]}/${m[1]}`;
        }
        return dateStr;
      }
      const dia = String(d.getDate()).padStart(2, '0');
      const mes = String(d.getMonth() + 1).padStart(2, '0');
      const ano = d.getFullYear();
      if (includeTime && dateStr.includes('T')) {
        const hora = String(d.getHours()).padStart(2, '0');
        const min = String(d.getMinutes()).padStart(2, '0');
        return `${dia}/${mes}/${ano} ${hora}:${min}`;
      }
      return `${dia}/${mes}/${ano}`;
    } catch {
      return dateStr;
    }
  },

  /**
   * Retorna apenas YYYY-MM-DD de uma data para filtros
   */
  toISODateOnly(dateStr) {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) {
        const m = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
        return m ? `${m[1]}-${m[2]}-${m[3]}` : '';
      }
      return d.toISOString().split('T')[0];
    } catch {
      return '';
    }
  },

  /**
   * Escapa caracteres HTML para exibição segura
   * @param {string} str
   * @returns {string}
   */
  escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  /**
   * Gera ID único para controle interno na memória
   */
  uid() {
    return 'nfe_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
  },

  /**
   * Normaliza o texto da Natureza da Operação para agrupamento
   * (maiúsculas, espaços simples, sem espaços nas pontas).
   */
  normalizeNatureza(natOp) {
    const s = String(natOp || '').replace(/\s+/g, ' ').trim().toUpperCase();
    return s || 'NÃO IDENTIFICADA';
  },

  /**
   * Classifica a Natureza da Operação.
   * 'venda'  -> operação de venda efetiva (base para apuração de impostos)
   * 'outras' -> retorno simbólico, remessa, devolução, transferência, bonificação etc.
   */
  classificarNatureza(natOp) {
    const s = this.normalizeNatureza(natOp)
      .normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (!s.includes('VENDA') && !s.includes('VENDIDA')) return 'outras';
    const naoVenda = ['RETORNO', 'SIMBOLIC', 'REMESSA', 'DEVOLU', 'ANULA', 'ESTORNO', 'CANCELAMENTO'];
    if (naoVenda.some(t => s.includes(t))) return 'outras';
    return 'venda';
  }
};
