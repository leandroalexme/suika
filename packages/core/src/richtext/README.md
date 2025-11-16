# Rich Text Module

Unified architecture for rich text editing in Suika Editor.

## 📂 Structure

```
richtext/
├── index.ts                      # Main export point
├── README.md                     # This file
│
├── graphics/                     # 🎨 Rendering & Layout
│   ├── rich-text.ts              # SuikaRichText (main class)
│   ├── layout-engine.ts          # Layout engine (word wrap, line break)
│   └── opentype-layout-renderer.ts # OpenType renderer (paths + underline)
│
├── editor/                       # ✏️ Editing & Selection
│   ├── rich_text_editor.ts       # Inline editor
│   └── range_manager.ts          # Selection & caret manager
│
├── font/                         # 🔤 Font Management
│   └── font_manager.ts           # FontManager (OpenType loader)
│
├── tools/                        # 🛠️ Editor Tools
│   └── tool_draw_rich_text.ts    # Tool to draw rich text
│
├── services/                     # 🏭 Factories
│   └── create_rich_text.ts       # Factory to create instances
│
└── types/                        # 📐 Types & Interfaces
    └── models.ts                 # TextRun, Paragraph, RichTextModel
```

## 🎯 Usage

### Import from main module

```typescript
import { 
  SuikaRichText,
  RichTextEditor,
  createRichText,
  type RichTextModel 
} from './richtext';
```

### Or from specific submodules

```typescript
import { SuikaRichText } from './richtext/graphics';
import { RichTextEditor } from './richtext/editor';
import { fontManager } from './richtext/font';
```

## 🏗️ Architecture

### Graphics Layer
- **SuikaRichText**: Main graphics class, extends `SuikaGraphics`
- **LayoutEngine**: Handles word wrap, line breaking, alignment
- **OpenTypeLayoutRenderer**: Renders text using OpenType.js paths

### Editor Layer
- **RichTextEditor**: Manages inline editing with invisible DOM input
- **RangeManager**: Handles text selection and caret positioning

### Font Layer
- **FontManager**: Loads and caches OpenType fonts
- Supports variants: Regular (400), Bold (700), Italic, Bold Italic

### Tools Layer
- **DrawRichTextTool**: Tool for creating new rich text elements

### Services Layer
- **createRichText**: Factory function to create SuikaRichText instances

### Types Layer
- **TextRun**: Text segment with formatting
- **Paragraph**: Collection of runs with alignment
- **RichTextModel**: Complete rich text data model

## 🚀 Features

- ✅ OpenType.js rendering (vector paths)
- ✅ Word wrap & multi-line layout
- ✅ Multiple paragraphs
- ✅ Alignment (left, center, right, justify)
- ✅ Line height control
- ✅ Inline editing with native IME support
- ✅ Text selection (mouse + keyboard)
- ✅ Formatting: Bold, Italic, Underline
- ✅ Font family & size control
- ✅ Text color

## 📝 Notes

- Font variants (Bold, Italic) require separate font files
- Underline is drawn manually (not part of OpenType glyph)
- All fonts are loaded locally as TTF/OTF files
- `RangeManager` is shared with basic text editor (`text/text_editor.ts`)

