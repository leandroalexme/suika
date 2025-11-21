# Rich Text Engine for Suika Editor

Uma implementação completa de rich text para HTML5 Canvas baseada na abordagem do Miro, com inspirações do Fabric.js e otimizações de performance.

## Visão Geral

Este Rich Text Engine implementa a solução descrita no artigo ["How we learned to draw text on HTML5 Canvas"](https://medium.com/miro-engineering/how-we-learned-to-draw-text-on-html5-canvas-9f5613e64f5) do Miro, seguindo uma abordagem em etapas:

### Etapa 1: Divisão do texto em partes lógicas
- **Blocos**: Parágrafos, cabeçalhos, listas, citações
- **Segmentos**: Partes do texto com estilo unificado
- **Palavras**: Unidades básicas com métricas calculadas

### Etapa 2: Layout e posicionamento
- Cálculo de métricas de cada palavra
- Quebra de linha inteligente
- Alinhamento e espaçamento
- Posicionamento de coordenadas X/Y

## Arquitetura

### Componentes Principais

#### 1. `RichTextEngine` - Classe Principal
```typescript
const engine = new RichTextEngine(config);
engine.setHTML('<p>Hello <strong>World</strong>!</p>');
engine.render(renderContext);
```

#### 2. `RichTextParser` - Parser de Conteúdo
- Suporte a HTML básico (`<p>`, `<h1>-<h3>`, `<strong>`, `<em>`, `<u>`, etc.)
- Suporte a Markdown (headers, listas, formatação inline)
- Parse de texto simples

#### 3. `RichTextMetrics` - Cálculo de Métricas
- Cache otimizado de medições de texto
- Cálculo de largura/altura de palavras
- Conversão entre coordenadas e índices de caracteres
- Quebra inteligente de palavras longas

#### 4. `RichTextLayoutEngine` - Engine de Layout
- Arranjo de palavras em linhas
- Quebra de linha automática
- Suporte a alinhamento (esquerda, centro, direita, justificado)
- Espaçamento de parágrafos e listas
- Indentação hierárquica

#### 5. `RichTextRenderer` - Renderizador Otimizado
- Cache de texto renderizado para performance
- Agrupamento de palavras com mesmo estilo
- Viewport culling para documentos grandes
- Decorações de texto (sublinhado, tachado)
- Marcadores de lista (bullets, números)

#### 6. `SuikaRichText` - Integração com Suika
- Extensão do `SuikaGraphics` com rich text
- Compatibilidade com editor existente
- Suporte a transformações e estilos
- Métodos para edição interativa

## Recursos Implementados

### ✅ Formatação de Texto
- **Negrito** (`<strong>`, `<b>`)
- *Itálico* (`<em>`, `<i>`)
- <u>Sublinhado</u> (`<u>`)
- ~~Tachado~~ (`<s>`)
- Cores personalizadas
- Famílias de fonte
- Tamanhos de fonte
- Espaçamento de linha

### ✅ Estrutura de Documento
- Parágrafos (`<p>`)
- Cabeçalhos (`<h1>`, `<h2>`, `<h3>`)
- Listas ordenadas (`<ol>`, `<li>`)
- Listas não ordenadas (`<ul>`, `<li>`)
- Citações (`<blockquote>`)
- Código (`<pre>`)

### ✅ Layout Avançado
- Quebra de linha automática
- Alinhamento de texto (esquerda, centro, direita, justificado)
- Espaçamento de parágrafos
- Indentação de listas
- Margem e padding customizáveis

### ✅ Performance
- Cache de métricas de texto
- Cache de renderização
- Viewport culling
- Agrupamento de estilos
- Limpeza automática de cache

### ✅ Interatividade
- Posicionamento de cursor por coordenadas
- Seleção de texto
- Inserção e edição de texto
- Aplicação de formatação
- Eventos de mudança

## Uso Básico

### Exemplo Simples
```typescript
import { RichTextEngine } from '@suika/core';

const config = {
  defaultStyle: {
    fontFamily: 'Arial',
    fontSize: 16,
    color: '#000000',
  },
  maxWidth: 400,
  wordWrap: true,
};

const engine = new RichTextEngine(config);

// HTML
engine.setHTML('<p>Hello <strong>World</strong>!</p>');

// Markdown
engine.setMarkdown('# Title\n\nThis is **bold** text.');

// Renderização
const renderContext = {
  ctx: canvasContext,
  x: 0,
  y: 0,
  width: 400,
  height: 300,
  scale: 1,
};

engine.render(renderContext);
```

### Integração com Suika
```typescript
import { SuikaRichText } from '@suika/core';

const richText = new SuikaRichText({
  content: '<h1>Rich Text</h1><p>In Suika Editor!</p>',
  fontSize: 16,
  fontFamily: 'Arial',
  richText: true,
  width: 300,
  height: 200,
  x: 100,
  y: 100,
}, { doc: editor.doc });

// Adicionar ao canvas
editor.sceneGraph.addItems([richText]);
```

## Comparação com Fabric.js

| Recurso | Fabric.js IText | Suika Rich Text |
|---------|----------------|-----------------|
| Performance | Moderada | Alta (cache otimizado) |
| Formatação | Básica | Avançada (HTML/Markdown) |
| Layout | Simples | Complexo (blocos, listas) |
| Memory Usage | Alta | Otimizada |
| Viewport Culling | Não | Sim |
| Unicode Support | Limitado | Completo |

## Vantagens da Implementação

### 1. **Performance Superior**
- Cache inteligente de métricas e renderização
- Viewport culling para documentos grandes
- Agrupamento de estilos para reduzir chamadas de API

### 2. **Flexibilidade**
- Suporte a HTML e Markdown
- Configuração granular de layout
- Extensibilidade através de eventos

### 3. **Compatibilidade**
- Integração nativa com Suika Editor
- Compatibilidade com transformações existentes
- API familiar para desenvolvedores Fabric.js

### 4. **Robustez**
- Testes unitários abrangentes
- Gerenciamento de memória automático
- Tratamento de edge cases

## Testes

Execute os testes unitários:
```bash
npm test -- packages/core/src/text/rich_text_engine.test.ts
```

Ou veja os exemplos em funcionamento:
```typescript
import { runExamples } from '@suika/core';
runExamples();
```

## Roadmap

### Próximas Funcionalidades
- [ ] Tabelas (`<table>`, `<tr>`, `<td>`)
- [ ] Imagens inline
- [ ] Links clicáveis
- [ ] Spell checking
- [ ] Drag & drop de texto
- [ ] Histórico de undo/redo mais sofisticado
- [ ] Suporte a RTL (right-to-left)

### Otimizações Futuras
- [ ] Web Workers para parsing de documentos grandes
- [ ] Streaming de layout para documentos enormes
- [ ] GPU acceleration via WebGL
- [ ] Compressão de cache para reduzir uso de memória

## Contribuindo

1. Siga a arquitetura modular existente
2. Adicione testes para novas funcionalidades
3. Mantenha a compatibilidade com a API existente
4. Documente mudanças na performance

## Referências

- [Miro Engineering - How we learned to draw text on HTML5 Canvas](https://medium.com/miro-engineering/how-we-learned-to-draw-text-on-html5-canvas-9f5613e64f5)
- [Fabric.js IText Documentation](https://fabricjs.com/api/classes/itext/)
- [HTML5 Canvas Text API](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/measureText)
- [TextMetrics API](https://developer.mozilla.org/en-US/docs/Web/API/TextMetrics)

---

Implementado seguindo as melhores práticas de performance e usabilidade para editores de canvas.