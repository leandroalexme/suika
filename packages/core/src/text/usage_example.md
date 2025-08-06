# Como Usar o Rich Text no Suika Editor

O Rich Text Engine foi integrado diretamente na classe `SuikaText` existente, mantendo total compatibilidade com o código anterior.

## Uso Básico

### 1. Texto Simples (comportamento padrão)
```typescript
const textSimples = new SuikaText({
  content: 'Texto simples',
  fontSize: 16,
  fontFamily: 'Arial',
  x: 100,
  y: 100,
}, { doc: editor.doc });
```

### 2. Ativando Rich Text
```typescript
const richText = new SuikaText({
  content: '<p>Texto com <strong>formatação</strong>!</p>',
  fontSize: 16,
  fontFamily: 'Arial',
  richText: true, // ← Ativa o modo rich text
  maxWidth: 300,
  textAlign: 'left',
  x: 100,
  y: 100,
}, { doc: editor.doc });
```

### 3. Convertendo Texto Existente para Rich Text
```typescript
const texto = new SuikaText({
  content: 'Texto simples',
  fontSize: 16,
  fontFamily: 'Arial',
}, { doc: editor.doc });

// Converter para rich text
texto.setRichTextMode(true);

// Adicionar conteúdo HTML
texto.setHTMLContent('<h1>Título</h1><p>Parágrafo com <em>ênfase</em>.</p>');
```

## Recursos Suportados

### Formatação de Texto
- **Negrito**: `<strong>texto</strong>` ou `<b>texto</b>`
- *Itálico*: `<em>texto</em>` ou `<i>texto</i>`
- <u>Sublinhado</u>: `<u>texto</u>`
- ~~Tachado~~: `<s>texto</s>`

### Estrutura de Documento
- Cabeçalhos: `<h1>`, `<h2>`, `<h3>`
- Parágrafos: `<p>texto</p>`
- Listas: `<ul><li>item</li></ul>` ou `<ol><li>item</li></ol>`
- Citações: `<blockquote>citação</blockquote>`

### Exemplo Completo
```typescript
const richTextCompleto = new SuikaText({
  content: `
    <h1>Meu Documento</h1>
    <p>Este é um parágrafo com <strong>texto em negrito</strong> e <em>texto em itálico</em>.</p>
    <h2>Lista de Tarefas</h2>
    <ul>
      <li>Primeira tarefa</li>
      <li>Segunda tarefa com <u>sublinhado</u></li>
      <li>Terceira tarefa</li>
    </ul>
    <blockquote>
      "Esta é uma citação importante."
    </blockquote>
  `,
  richText: true,
  fontSize: 14,
  fontFamily: 'Arial',
  maxWidth: 400,
  textAlign: 'left',
  lineHeight: 1.4,
  x: 50,
  y: 50,
}, { doc: editor.doc });
```

## Configurações Avançadas

### Alinhamento de Texto
```typescript
richText.updateAttrs({ textAlign: 'center' }); // 'left', 'center', 'right', 'justify'
```

### Largura Máxima com Quebra de Linha
```typescript
richText.updateAttrs({ 
  maxWidth: 300,
  // O texto quebra automaticamente na largura especificada
});
```

### Espaçamento de Linha
```typescript
richText.updateAttrs({ 
  lineHeight: 1.6, // 1.6x o tamanho da fonte
});
```

## Métodos Disponíveis

### Verificação de Modo
```typescript
if (texto.isRichTextMode()) {
  console.log('Rich text ativado');
}
```

### Definir Conteúdo HTML
```typescript
texto.setHTMLContent('<h2>Novo Título</h2><p>Novo conteúdo.</p>');
```

### Ativar/Desativar Rich Text
```typescript
texto.setRichTextMode(true);  // Ativar
texto.setRichTextMode(false); // Desativar (volta ao texto simples)
```

## Compatibilidade

✅ **Total compatibilidade** com código existente  
✅ **Performance otimizada** com cache inteligente  
✅ **Quebra de linha automática**  
✅ **Suporte a transformações** (escala, rotação, etc.)  
✅ **Integração perfeita** com o editor Suika  

## Detecção Automática

O sistema detecta automaticamente se o conteúdo contém HTML:

```typescript
// Será tratado como rich text automaticamente se richText: true
const autoDetect = new SuikaText({
  content: '<p>Contém <strong>HTML</strong></p>',
  richText: true,
  // ... outras propriedades
});
```

O Rich Text Engine implementa a abordagem do Miro para máxima performance e qualidade de renderização!