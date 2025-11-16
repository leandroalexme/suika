# 📦 Font Files

Fontes organizadas por pasta para uso com OpenType.js no editor Suika.

## 📁 Estrutura

```
font_files/
├── roboto/          # Roboto (Google) - fonte padrão clean
├── inter/           # Inter (GitHub) - bold muito visível! ⭐
├── open-sans/       # Open Sans (Google) - versátil
├── smiley-sans/     # Smiley Sans (Chinese) - oblique style
└── source-han-sans/ # Source Han Sans CN (Adobe) - suporte CJK
```

## ✅ Variantes Disponíveis

Cada fonte possui as seguintes variantes:
- **Regular** (400)
- **Bold** (700)
- **Italic** (400italic)
- **Bold Italic** (700italic)

**Exceção:** Source Han Sans CN possui apenas Regular (fonte CJK completa é muito pesada).

## 🎯 Fontes Recomendadas

### **Inter** ⭐ (Melhor para visualizar Bold/Italic)
- Bold **muito visível** e distinto
- Ideal para testar formatação
- Ótima legibilidade em telas

### **Roboto**
- Fonte padrão do Google/Android
- Clean e profissional
- Bold mais sutil

### **Open Sans**
- Versátil para qualquer uso
- Boa legibilidade
- Popular em web

### **Smiley Sans**
- Fonte chinesa com estilo oblique
- Design moderno e amigável
- Suporte CJK limitado

## 📥 Como Adicionar Novas Fontes

1. **Crie uma pasta** para a fonte:
   ```bash
   mkdir font_files/nova-fonte
   ```

2. **Baixe os arquivos TTF/OTF** com as variantes:
   - `NovaFonte-Regular.ttf`
   - `NovaFonte-Bold.ttf`
   - `NovaFonte-Italic.ttf`
   - `NovaFonte-BoldItalic.ttf`

3. **Atualize** `apps/suika/src/constant.ts`:
   ```typescript
   export const FONT_FILES = {
     // ... outras fontes ...
     'Nova Fonte': './font_files/nova-fonte/NovaFonte-Regular.ttf',
     'Nova Fonte-400': './font_files/nova-fonte/NovaFonte-Regular.ttf',
     'Nova Fonte-700': './font_files/nova-fonte/NovaFonte-Bold.ttf',
     'Nova Fonte-400italic': './font_files/nova-fonte/NovaFonte-Italic.ttf',
     'Nova Fonte-700italic': './font_files/nova-fonte/NovaFonte-BoldItalic.ttf',
   };
   ```

4. **Rebuild** o core:
   ```bash
   cd packages/core && pnpm run build
   ```

## ⚠️ Importante

- **OpenType.js NÃO suporta WOFF2** (formato do Google Fonts API)
- Use **TTF ou OTF** apenas
- Cada variante (Bold, Italic) é um **arquivo separado**
- Não existe "fake bold" - deve-se carregar `FontName-Bold.ttf`

## 🔗 Fontes Usadas

- **Roboto**: [Google Fonts](https://fonts.google.com/specimen/Roboto)
- **Inter**: [GitHub rsms/inter](https://github.com/rsms/inter)
- **Open Sans**: [Google Fonts](https://fonts.google.com/specimen/Open+Sans)
- **Smiley Sans**: [GitHub atelier-anchor/smiley-sans](https://github.com/atelier-anchor/smiley-sans)
- **Source Han Sans**: [Adobe Fonts](https://github.com/adobe-fonts/source-han-sans)

## 📊 Tamanhos

- Roboto: ~1.7 MB (4 variantes)
- Inter: ~1.6 MB (4 variantes)
- Open Sans: ~601 KB (4 variantes)
- Smiley Sans: ~1.9 MB (1 variante oblique)
- Source Han Sans CN: ~8.3 MB (1 variante - CJK completo)

**Total**: ~14.1 MB

