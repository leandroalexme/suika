/**
 * Rich Text Engine Usage Example
 * Demonstrates how to use the rich text system in Suika Editor
 */

import { RichTextEngine } from './rich_text_engine';
import { SuikaRichText } from '../graphics/rich_text';
import { IRichTextConfig, ITextStyle, IRichTextRenderContext } from './rich_text_types';

/**
 * Example 1: Basic Rich Text Engine Usage
 */
export function basicRichTextExample() {
  // Configure the rich text engine
  const defaultStyle: ITextStyle = {
    fontFamily: 'Arial, sans-serif',
    fontSize: 16,
    color: '#333333',
    lineHeight: 1.4,
  };

  const config: IRichTextConfig = {
    defaultStyle,
    maxWidth: 400,
    wordWrap: true,
    textAlign: 'left',
    lineSpacing: 1.2,
    paragraphSpacing: 12,
    listIndentation: 24,
  };

  const engine = new RichTextEngine(config);

  // Example HTML content with various formatting
  const htmlContent = `
    <h1>Rich Text in Canvas</h1>
    <p>This is a <strong>bold</strong> example of <em>rich text</em> rendering 
    directly on <u>HTML5 Canvas</u> using the <strong><em>Miro approach</em></strong>.</p>
    
    <h2>Features Supported:</h2>
    <ul>
      <li><strong>Bold</strong> and <em>italic</em> text</li>
      <li>Multiple <u>text decorations</u></li>
      <li>Different heading levels</li>
      <li>Proper line wrapping</li>
      <li>List formatting</li>
    </ul>
    
    <h3>Performance Benefits:</h3>
    <p>This implementation provides:</p>
    <ol>
      <li>Cached text rendering for performance</li>
      <li>Proper text metrics calculation</li>
      <li>Viewport culling for large documents</li>
      <li>Memory efficient caching</li>
    </ol>
    
    <blockquote>
      "The best rich text editor is one that feels native to the platform." 
      - A wise developer
    </blockquote>
  `;

  // Set the HTML content
  engine.setHTML(htmlContent);

  // Get the layout (this performs all the parsing and layout calculations)
  const layout = engine.getLayout();
  console.log('Layout created:', {
    lines: layout?.lines.length,
    words: layout?.words.length,
    dimensions: engine.getDimensions(),
  });

  // Example rendering to canvas
  const canvas = document.createElement('canvas');
  canvas.width = 500;
  canvas.height = 800;
  const ctx = canvas.getContext('2d')!;

  const renderContext: IRichTextRenderContext = {
    ctx,
    x: 50,
    y: 50,
    width: 400,
    height: 700,
    scale: 1,
    opacity: 1,
  };

  // Clear canvas
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Render the rich text
  engine.render(renderContext);

  return { engine, canvas, layout };
}

/**
 * Example 2: Using SuikaRichText Graphics Object
 */
export function suikaRichTextExample() {
  // Mock editor document (you would use real editor in practice)
  const mockDoc = {
    getCurrCanvas: () => ({ insertChild: () => {} }),
  };

  // Create a rich text graphics object
  const richText = new SuikaRichText(
    {
      objectName: 'Example Rich Text',
      content: '<h1>Hello</h1><p>This is <strong>rich text</strong> in Suika!</p>',
      fontSize: 16,
      fontFamily: 'Arial',
      richText: true, // Enable rich text mode
      maxWidth: 300,
      textAlign: 'left',
      lineHeight: 1.3,
      x: 100,
      y: 100,
      width: 300,
      height: 200,
    },
    {
      doc: mockDoc as any,
    }
  );

  // Example of updating content
  richText.setHTMLContent(`
    <h2>Updated Content</h2>
    <p>This content was updated using <em>setHTMLContent</em> method.</p>
    <ul>
      <li>Dynamic updates</li>
      <li>Rich formatting</li>
      <li>Auto-sizing</li>
    </ul>
  `);

  return richText;
}

/**
 * Example 3: Markdown Support
 */
export function markdownExample() {
  const config: IRichTextConfig = {
    defaultStyle: {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: 14,
      color: '#2d3748',
    },
    maxWidth: 600,
    wordWrap: true,
  };

  const engine = new RichTextEngine(config);

  const markdownContent = `
# Markdown Support

This rich text engine also supports **Markdown** formatting!

## Features

- **Bold** and *italic* text
- Multiple heading levels
- Unordered and ordered lists
- > Blockquotes for emphasis
- \`\`\`Code blocks\`\`\`

## Lists

### Unordered:
- First item
- Second item
  - Nested item
  - Another nested item
- Third item

### Ordered:
1. First step
2. Second step
3. Third step

> This is a blockquote that demonstrates
> how multiple lines are handled in
> the markdown parser.
  `;

  engine.setMarkdown(markdownContent);
  return engine;
}

/**
 * Example 4: Performance Testing
 */
export function performanceExample() {
  const config: IRichTextConfig = {
    defaultStyle: {
      fontFamily: 'system-ui, sans-serif',
      fontSize: 14,
      color: '#000000',
    },
    maxWidth: 800,
    wordWrap: true,
  };

  const engine = new RichTextEngine(config);

  // Generate large content for performance testing
  const generateLargeContent = () => {
    let content = '<h1>Performance Test Document</h1>';
    
    for (let i = 0; i < 50; i++) {
      content += `
        <h2>Section ${i + 1}</h2>
        <p>This is paragraph ${i + 1} with <strong>bold text</strong> and <em>italic text</em>. 
        Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor 
        incididunt ut labore et dolore magna aliqua.</p>
        
        <ul>
          <li>List item 1 in section ${i + 1}</li>
          <li>List item 2 with <u>underlined text</u></li>
          <li>List item 3 with multiple <strong><em>combined</em></strong> formats</li>
        </ul>
      `;
    }
    
    return content;
  };

  const startTime = performance.now();
  
  const largeContent = generateLargeContent();
  engine.setHTML(largeContent);
  
  const parseTime = performance.now();
  
  const layout = engine.getLayout();
  
  const layoutTime = performance.now();
  
  console.log('Performance Metrics:', {
    contentLength: largeContent.length,
    parseTime: parseTime - startTime,
    layoutTime: layoutTime - parseTime,
    totalTime: layoutTime - startTime,
    blocksCreated: layout?.blocks.length,
    wordsCreated: layout?.words.length,
    linesCreated: layout?.lines.length,
    cacheStats: engine.getCacheStats(),
  });

  return engine;
}

/**
 * Example 5: Interactive Rich Text Editor
 */
export function interactiveEditorExample() {
  const config: IRichTextConfig = {
    defaultStyle: {
      fontFamily: 'system-ui, sans-serif',
      fontSize: 16,
      color: '#1a202c',
    },
    maxWidth: 500,
    wordWrap: true,
    textAlign: 'left',
  };

  const engine = new RichTextEngine(config);

  // Initial content
  engine.setHTML('<p>Click anywhere to edit this text...</p>');

  // Event handling example
  engine.on('content-changed', (content) => {
    console.log('Content updated:', content.plainText.length, 'characters');
  });

  engine.on('selection-changed', (selection) => {
    if (selection) {
      console.log('Selection:', selection.start.characterIndex, 'to', selection.end.characterIndex);
    }
  });

  engine.on('cursor-changed', (cursor) => {
    if (cursor) {
      console.log('Cursor at:', cursor.x, cursor.y);
    }
  });

  // Simulate cursor positioning
  const handleClick = (x: number, y: number) => {
    const position = engine.getPositionFromCoordinates(x, y);
    if (position) {
      engine.setCursor(position);
    }
  };

  // Simulate text insertion
  const insertText = (text: string, formatting?: Partial<ITextStyle>) => {
    engine.insertText(text, formatting);
  };

  // Simulate formatting application
  const applyBold = () => {
    engine.applyFormatting({ fontWeight: 'bold' });
  };

  const applyItalic = () => {
    engine.applyFormatting({ fontStyle: 'italic' });
  };

  return {
    engine,
    handleClick,
    insertText,
    applyBold,
    applyItalic,
  };
}

/**
 * Example 6: Integration with Fabric.js concepts
 */
export function fabricJsStyleExample() {
  // This example shows how the rich text engine can be used
  // in a way similar to Fabric.js IText but with better performance
  
  const config: IRichTextConfig = {
    defaultStyle: {
      fontFamily: 'Arial',
      fontSize: 18,
      color: '#000000',
    },
    maxWidth: 400,
    wordWrap: true,
  };

  const engine = new RichTextEngine(config);

  // Start with simple text like Fabric.js Text
  engine.setText('Tap and Type');

  // Convert to rich text mode (like switching from Text to IText)
  const enableRichText = () => {
    const currentText = engine.getPlainText();
    engine.setHTML(`<p>${currentText}</p>`);
  };

  // Fabric.js-like styling methods
  const setFontSize = (size: number) => {
    engine.updateConfig({
      defaultStyle: {
        ...config.defaultStyle,
        fontSize: size,
      },
    });
  };

  const setFontFamily = (family: string) => {
    engine.updateConfig({
      defaultStyle: {
        ...config.defaultStyle,
        fontFamily: family,
      },
    });
  };

  const setTextAlign = (align: 'left' | 'center' | 'right' | 'justify') => {
    engine.updateConfig({ textAlign: align });
  };

  // Fabric.js-like selection and editing
  const selectAll = () => {
    const content = engine.getContent();
    if (content) {
      engine.setSelection({
        start: { characterIndex: 0, blockIndex: 0, segmentIndex: 0 },
        end: { characterIndex: content.totalCharacterCount, blockIndex: content.blocks.length - 1, segmentIndex: 0 },
        collapsed: false,
      });
    }
  };

  return {
    engine,
    enableRichText,
    setFontSize,
    setFontFamily,
    setTextAlign,
    selectAll,
  };
}

// Usage examples:
export function runExamples() {
  console.log('Running Rich Text Examples...');

  // Example 1: Basic usage
  console.log('\n1. Basic Rich Text Example:');
  const basic = basicRichTextExample();
  
  // Example 2: Suika graphics integration
  console.log('\n2. Suika Rich Text Graphics Example:');
  const suika = suikaRichTextExample();
  
  // Example 3: Markdown support
  console.log('\n3. Markdown Example:');
  const markdown = markdownExample();
  
  // Example 4: Performance testing
  console.log('\n4. Performance Example:');
  const performance = performanceExample();
  
  // Example 5: Interactive editor
  console.log('\n5. Interactive Editor Example:');
  const interactive = interactiveEditorExample();
  
  // Example 6: Fabric.js style
  console.log('\n6. Fabric.js Style Example:');
  const fabricStyle = fabricJsStyleExample();

  return {
    basic,
    suika,
    markdown,
    performance,
    interactive,
    fabricStyle,
  };
}