# Somador de Notas 🧾

> Aplicação web moderna, segura e com rigor contábil para importação em lote, desduplicação inteligente, conferência visual e soma de notas fiscais eletrônicas (**NF-e modelo 55**) e seus respectivos **DANFEs** em PDF.

---

## 🚀 Demonstração Rápida e Hospedagem

Esta aplicação é **100% Client-Side** (processamento integral na memória do navegador sem necessidade de backend ou banco de dados externo).

Ao ser hospedada no **GitHub Pages**, fica disponível publicamente via HTTPS para acesso em qualquer computador, tablet ou celular, preservando a privacidade total dos documentos fiscais.

---

## ✨ Funcionalidades Principais

- **Importação em Lote e Drag & Drop:**
  - Arraste ou selecione múltiplos arquivos XML e PDF simultaneamente.
  - Adição incremental: novos lotes são incorporados sem apagar notas já carregadas.
  - Suporte a PDFs com várias páginas (agrupa folhas da mesma nota e separa notas diferentes no mesmo arquivo).

- **Leitura Rigorosa de XML:**
  - Suporta NF-e com ou sem envelope `<nfeProc>`.
  - Extração do valor total especificamente pelo campo oficial **`total/ICMSTot/vNF`**.
  - Identificação de eventos de cancelamento (`tpEvento 110111`) com exclusão automática da soma padrão.
  - Segregação de documentos de outros modelos (NFS-e, CT-e, MDF-e, CF-e).

- **Leitura Inteligente de DANFE em PDF:**
  - Extração de texto digital via `PDF.js` com fallback para OCR em português (`Tesseract.js`).
  - Extrator espacial resiliente a layouts colunares de ERPs (ex: Bling, Tiny, Mercado Livre).
  - Decomposição SEFAZ da chave de 44 dígitos (extração de Número, Série e CNPJ).
  - Trava de segurança: leituras incertas são marcadas para revisão e excluídas da soma até validação.

- **Conferência Lado a Lado:**
  - Visualizador do documento PDF original em alta resolução (com zoom e navegação de páginas) ao lado dos campos estruturados para edição manual.
  - Registro de auditoria (*"Editado manualmente"*).

- **Desduplicação Inteligente:**
  - Casamento de XML e PDF da mesma nota (classificada como `XML + PDF`), evitando dupla contagem.
  - Sinalização de divergências de valores entre o XML e o PDF.
  - Preservação de notas distintas com mesmo valor financeiro.

- **Precisão Matemática e Regras Contábeis:**
  - Cálculo monetário processado estritamente em **inteiros de centavos**, eliminando erros de ponto flutuante.
  - Regra contábil de devoluções explícita: notas de devolução são somadas ao montante geral das notas incluídas.
  - Subtotais instantâneos ao filtrar ou pesquisar.

- **Visualização Oficial do DANFE:**
  - Renderiza o layout oficial da SEFAZ com canhoto de recebimento, código de barras Code128, cabeçalho, cálculo do imposto e itens discriminados.
  - Permite imprimir em A4, salvar em PDF e baixar o XML original.

- **Exportação:**
  - **Excel (.xlsx):** Planilha formatada com abas para *Notas Incluídas*, *Excluídas/Pendências* e *Resumo da Apuração*.
  - **Relatório PDF:** Documento executivo formal de auditoria com carimbo de data/hora e totalizadores.

---

## 🛠️ Tecnologias Utilizadas

- **HTML5 & CSS3:** Interface limpa, responsiva (desktop e mobile), paleta azul-marinho (`#0f2b5c`) e verde esmeralda (`#10b981`).
- **JavaScript Vanilla (ES6+):** Arquitetura orientada a serviços e módulos desacoplados.
- **Bibliotecas Locais (Zero Dependência Externa):**
  - [PDF.js](https://mozilla.github.io/pdf.js/) (v3.11.174)
  - [SheetJS / XLSX](https://sheetjs.com/)
  - [jsPDF](https://github.com/parallax/jsPDF) & [AutoTable](https://github.com/simonbengtsson/jsPDF-AutoTable)
  - [JsBarcode](https://lindell.me/JsBarcode/)
  - [Tesseract.js](https://tesseract.projectnaptha.com/)

---

## 💻 Como Executar Localmente

### Opção 1: Via Servidor Leve Incluso (Windows)
Basta dar um duplo-clique no arquivo:
```cmd
iniciar.bat
```
Ele abrirá automaticamente em `http://localhost:8080/`.

### Opção 2: Terminal (PowerShell)
```powershell
powershell -ExecutionPolicy Bypass -File server.ps1
```

### Opção 3: Abrir Diretamente no Navegador
Dê um duplo-clique em `index.html`. O sistema possui fallback para execução direta em `file:///`.

---

## 🌐 Como Publicar no GitHub Pages

1. Crie um repositório no seu GitHub (ex: `somador-de-notas`).
2. Conecte o repositório local e envie os arquivos:
   ```bash
   git remote add origin https://github.com/SEU_USUARIO/somador-de-notas.git
   git branch -M main
   git push -u origin main
   ```
3. No GitHub, acesse **Settings** > **Pages**.
4. Em **Branch**, selecione `main` e a pasta `/ (root)`.
5. Clique em **Save**. Em instantes, a aplicação estará online no endereço:
   `https://SEU_USUARIO.github.io/somador-de-notas/`

---

## 🔒 Privacidade e LGPD

O Somador de Notas não coleta, não envia e não armazena documentos fiscais em servidores de terceiros. Todos os dados permanecem temporariamente na memória RAM do seu navegador durante a sessão. Ao fechar a aba ou recarregar a página (`F5`), as notas são descartadas da memória.

---

## 📄 Licença

Distribuído sob a licença MIT. Consulte `LICENSE` para mais informações.
