/**
 * Rich Text Engine Tests
 * Demonstrates and validates the implementation
 */

import { RichTextEngine } from './rich_text_engine';
import { IRichTextConfig, ITextStyle, BlockType } from './rich_text_types';

// Mock canvas context for testing
class MockCanvasRenderingContext2D {
  font = '';
  fillStyle = '';
  strokeStyle = '';
  lineWidth = 1;
  lineCap: CanvasLineCap = 'butt';
  fontKerning = 'auto';
  globalAlpha = 1;

  measureText(text: string): TextMetrics {
    // Simple mock implementation
    const charWidth = 8; // Approximate character width
    const fontSize = 16; // Default font size
    
    return {
      width: text.length * charWidth,
      fontBoundingBoxAscent: fontSize * 0.8,
      fontBoundingBoxDescent: fontSize * 0.2,
    } as TextMetrics;
  }

  fillText(text: string, x: number, y: number): void {
    // Mock implementation
  }

  strokeText(text: string, x: number, y: number): void {
    // Mock implementation
  }

  fillRect(x: number, y: number, width: number, height: number): void {
    // Mock implementation
  }

  save(): void {}
  restore(): void {}
  translate(x: number, y: number): void {}
  transform(a: number, b: number, c: number, d: number, e: number, f: number): void {}
  scale(x: number, y: number): void {}
  beginPath(): void {}
  moveTo(x: number, y: number): void {}
  lineTo(x: number, y: number): void {}
  stroke(): void {}
  fill(): void {}
  arc(x: number, y: number, radius: number, startAngle: number, endAngle: number): void {}
  drawImage(image: CanvasImageSource, sx: number, sy: number): void {}
}

// Mock HTMLCanvasElement
class MockHTMLCanvasElement {
  width = 1;
  height = 1;

  getContext(contextId: string): MockCanvasRenderingContext2D | null {
    if (contextId === '2d') {
      return new MockCanvasRenderingContext2D();
    }
    return null;
  }
}

// Mock document.createElement for canvas
const originalCreateElement = document.createElement;
beforeAll(() => {
  document.createElement = jest.fn().mockImplementation((tagName: string) => {
    if (tagName === 'canvas') {
      return new MockHTMLCanvasElement() as any;
    }
    return originalCreateElement.call(document, tagName);
  });
});

afterAll(() => {
  document.createElement = originalCreateElement;
});

describe('RichTextEngine', () => {
  let engine: RichTextEngine;
  let config: IRichTextConfig;

  beforeEach(() => {
    const defaultStyle: ITextStyle = {
      fontFamily: 'Arial',
      fontSize: 16,
      color: '#000000',
    };

    config = {
      defaultStyle,
      maxWidth: 300,
      wordWrap: true,
      lineSpacing: 1.2,
      paragraphSpacing: 8,
      listIndentation: 20,
    };

    engine = new RichTextEngine(config);
  });

  afterEach(() => {
    engine.destroy();
  });

  describe('Plain Text', () => {
    test('should parse plain text', () => {
      const text = 'Hello, World!';
      engine.setText(text);
      
      const content = engine.getContent();
      expect(content).toBeTruthy();
      expect(content!.plainText).toBe(text);
      expect(content!.blocks).toHaveLength(1);
      expect(content!.blocks[0].type).toBe(BlockType.Paragraph);
    });

    test('should get plain text', () => {
      const text = 'Hello, World!';
      engine.setText(text);
      
      expect(engine.getPlainText()).toBe(text);
    });
  });

  describe('HTML Parsing', () => {
    test('should parse simple HTML', () => {
      const html = '<p>Hello <strong>World</strong>!</p>';
      engine.setHTML(html);
      
      const content = engine.getContent();
      expect(content).toBeTruthy();
      expect(content!.blocks).toHaveLength(1);
      expect(content!.blocks[0].type).toBe(BlockType.Paragraph);
      expect(content!.blocks[0].segments.length).toBeGreaterThan(1);
    });

    test('should parse multiple paragraphs', () => {
      const html = '<p>First paragraph</p><p>Second paragraph</p>';
      engine.setHTML(html);
      
      const content = engine.getContent();
      expect(content).toBeTruthy();
      expect(content!.blocks).toHaveLength(2);
      expect(content!.blocks[0].type).toBe(BlockType.Paragraph);
      expect(content!.blocks[1].type).toBe(BlockType.Paragraph);
    });

    test('should parse headings', () => {
      const html = '<h1>Title</h1><h2>Subtitle</h2><h3>Sub-subtitle</h3>';
      engine.setHTML(html);
      
      const content = engine.getContent();
      expect(content).toBeTruthy();
      expect(content!.blocks).toHaveLength(3);
      expect(content!.blocks[0].type).toBe(BlockType.Heading1);
      expect(content!.blocks[1].type).toBe(BlockType.Heading2);
      expect(content!.blocks[2].type).toBe(BlockType.Heading3);
    });

    test('should handle nested formatting', () => {
      const html = '<p><strong><em>Bold and italic</em></strong> text</p>';
      engine.setHTML(html);
      
      const content = engine.getContent();
      expect(content).toBeTruthy();
      expect(content!.blocks[0].segments.length).toBeGreaterThan(1);
      
      // Check that styles are applied correctly
      const firstSegment = content!.blocks[0].segments[0];
      expect(firstSegment.style.fontWeight).toBe('bold');
      expect(firstSegment.style.fontStyle).toBe('italic');
    });
  });

  describe('Markdown Parsing', () => {
    test('should parse markdown headers', () => {
      const markdown = '# Title\n## Subtitle\n### Sub-subtitle';
      engine.setMarkdown(markdown);
      
      const content = engine.getContent();
      expect(content).toBeTruthy();
      expect(content!.blocks).toHaveLength(3);
      expect(content!.blocks[0].type).toBe(BlockType.Heading1);
      expect(content!.blocks[1].type).toBe(BlockType.Heading2);
      expect(content!.blocks[2].type).toBe(BlockType.Heading3);
    });

    test('should parse markdown lists', () => {
      const markdown = '- Item 1\n- Item 2\n- Item 3';
      engine.setMarkdown(markdown);
      
      const content = engine.getContent();
      expect(content).toBeTruthy();
      expect(content!.blocks).toHaveLength(3);
      content!.blocks.forEach(block => {
        expect(block.type).toBe(BlockType.ListItem);
      });
    });

    test('should parse ordered lists', () => {
      const markdown = '1. First\n2. Second\n3. Third';
      engine.setMarkdown(markdown);
      
      const content = engine.getContent();
      expect(content).toBeTruthy();
      expect(content!.blocks).toHaveLength(3);
      content!.blocks.forEach(block => {
        expect(block.type).toBe(BlockType.ListItem);
      });
    });
  });

  describe('Layout', () => {
    test('should create layout from content', () => {
      const text = 'Hello, World! This is a longer text that should wrap to multiple lines.';
      engine.setText(text);
      
      const layout = engine.getLayout();
      expect(layout).toBeTruthy();
      expect(layout!.lines.length).toBeGreaterThan(0);
      expect(layout!.words.length).toBeGreaterThan(0);
      expect(layout!.totalWidth).toBeGreaterThan(0);
      expect(layout!.totalHeight).toBeGreaterThan(0);
    });

    test('should calculate dimensions', () => {
      const text = 'Hello, World!';
      engine.setText(text);
      
      const dimensions = engine.getDimensions();
      expect(dimensions.width).toBeGreaterThan(0);
      expect(dimensions.height).toBeGreaterThan(0);
    });
  });

  describe('Coordinate Conversion', () => {
    test('should convert coordinates to position', () => {
      const text = 'Hello, World!';
      engine.setText(text);
      
      // Get layout to ensure it's calculated
      engine.getLayout();
      
      const position = engine.getPositionFromCoordinates(50, 10);
      expect(position).toBeTruthy();
      expect(position!.characterIndex).toBeGreaterThanOrEqual(0);
    });

    test('should convert position to coordinates', () => {
      const text = 'Hello, World!';
      engine.setText(text);
      
      // Get layout to ensure it's calculated
      engine.getLayout();
      
      const coords = engine.getCoordinatesFromPosition({
        characterIndex: 5,
        blockIndex: 0,
        segmentIndex: 0,
      });
      
      expect(coords).toBeTruthy();
      expect(coords!.x).toBeGreaterThanOrEqual(0);
      expect(coords!.y).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Configuration', () => {
    test('should update configuration', () => {
      engine.setText('Hello, World!');
      
      const newConfig = {
        maxWidth: 500,
        textAlign: 'center' as const,
      };
      
      engine.updateConfig(newConfig);
      
      // Should trigger re-layout
      const layout = engine.getLayout();
      expect(layout).toBeTruthy();
    });
  });

  describe('HTML Export', () => {
    test('should export to HTML', () => {
      const html = '<p>Hello <strong>World</strong>!</p>';
      engine.setHTML(html);
      
      const exported = engine.exportToHTML();
      expect(exported).toContain('Hello');
      expect(exported).toContain('World');
      expect(exported).toContain('<strong>');
    });
  });

  describe('Events', () => {
    test('should emit content-changed event', (done) => {
      engine.on('content-changed', (content) => {
        expect(content).toBeTruthy();
        done();
      });
      
      engine.setText('Hello, World!');
    });

    test('should emit layout-changed event', (done) => {
      engine.on('layout-changed', (layout) => {
        expect(layout).toBeTruthy();
        done();
      });
      
      engine.setText('Hello, World!');
      engine.getLayout(); // Trigger layout calculation
    });
  });

  describe('Performance', () => {
    test('should handle large text efficiently', () => {
      const largeText = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(100);
      
      const startTime = performance.now();
      engine.setText(largeText);
      engine.getLayout();
      const endTime = performance.now();
      
      // Should complete within reasonable time (less than 100ms)
      expect(endTime - startTime).toBeLessThan(100);
    });

    test('should cache metrics efficiently', () => {
      engine.setText('Hello, World! This text contains repeated words and patterns.');
      engine.getLayout();
      
      const stats = engine.getCacheStats();
      expect(stats.metricsCache).toBeGreaterThan(0);
      expect(stats.rendererCache.size).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Memory Management', () => {
    test('should clear caches', () => {
      engine.setText('Hello, World!');
      engine.getLayout();
      
      // Should have some cached data
      let stats = engine.getCacheStats();
      expect(stats.metricsCache).toBeGreaterThan(0);
      
      // Clear caches
      engine.clearCaches();
      
      // Should have no cached data
      stats = engine.getCacheStats();
      expect(stats.metricsCache).toBe(0);
      expect(stats.rendererCache.size).toBe(0);
    });
  });
});

describe('Integration Test - Miro Approach', () => {
  test('should follow Miro approach: text to blocks to words to lines to render', () => {
    const defaultStyle: ITextStyle = {
      fontFamily: 'Arial',
      fontSize: 16,
      color: '#000000',
    };

    const config: IRichTextConfig = {
      defaultStyle,
      maxWidth: 200,
      wordWrap: true,
    };

    const engine = new RichTextEngine(config);
    
    // Step 1: Set content (HTML with formatting)
    const html = '<p>Hello <strong>Bold</strong> and <em>Italic</em> text!</p>';
    engine.setHTML(html);
    
    const content = engine.getContent();
    expect(content).toBeTruthy();
    
    // Step 2: Verify blocks are created
    expect(content!.blocks).toHaveLength(1);
    expect(content!.blocks[0].type).toBe(BlockType.Paragraph);
    expect(content!.blocks[0].segments.length).toBeGreaterThan(1);
    
    // Step 3: Get layout (this triggers word segmentation and line creation)
    const layout = engine.getLayout();
    expect(layout).toBeTruthy();
    
    // Step 4: Verify words are created with proper metrics
    expect(layout!.words.length).toBeGreaterThan(0);
    layout!.words.forEach(word => {
      expect(word.width).toBeGreaterThan(0);
      expect(word.height).toBeGreaterThan(0);
      expect(word.text).toBeTruthy();
    });
    
    // Step 5: Verify lines are created
    expect(layout!.lines.length).toBeGreaterThan(0);
    layout!.lines.forEach(line => {
      expect(line.words.length).toBeGreaterThan(0);
      expect(line.width).toBeGreaterThanOrEqual(0);
      expect(line.height).toBeGreaterThan(0);
    });
    
    // Step 6: Verify overall dimensions
    expect(layout!.totalWidth).toBeGreaterThan(0);
    expect(layout!.totalHeight).toBeGreaterThan(0);
    
    // Step 7: Test rendering (mock context)
    const mockCtx = new MockCanvasRenderingContext2D();
    const renderContext = {
      ctx: mockCtx as any,
      x: 0,
      y: 0,
      width: 200,
      height: 100,
      scale: 1,
    };
    
    // Should not throw
    expect(() => {
      engine.render(renderContext);
    }).not.toThrow();
    
    engine.destroy();
  });
});