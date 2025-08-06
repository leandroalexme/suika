import {
  IRichTextConfig,
  IRichTextContent,
  IRichTextLayout,
  IRichTextSelection,
  IRichTextCursor,
  IRichTextPosition,
  IRichTextRenderContext,
  ITextStyle,
  BlockType,
} from './rich_text_types';
import { RichTextParser } from './rich_text_parser';
import { RichTextMetrics } from './rich_text_metrics';
import { RichTextLayoutEngine } from './rich_text_layout';
import { RichTextRenderer } from './rich_text_renderer';

/**
 * Main Rich Text Engine
 * Integrates all components following the Miro approach
 */
export class RichTextEngine {
  private parser: RichTextParser;
  private metrics: RichTextMetrics;
  private layoutEngine: RichTextLayoutEngine;
  private renderer: RichTextRenderer;
  private config: IRichTextConfig;
  
  private content: IRichTextContent | null = null;
  private layout: IRichTextLayout | null = null;
  private selection: IRichTextSelection | null = null;
  private cursor: IRichTextCursor | null = null;
  
  private eventListeners = new Map<string, Function[]>();

  constructor(config: IRichTextConfig) {
    this.config = config;
    this.parser = new RichTextParser(config.defaultStyle);
    this.metrics = new RichTextMetrics();
    this.layoutEngine = new RichTextLayoutEngine(this.metrics, config);
    this.renderer = new RichTextRenderer();
  }

  /**
   * Set content from HTML string
   */
  setHTML(html: string): void {
    const newContent = this.parser.parseHTML(html);
    this.setContent(newContent);
  }

  /**
   * Set content from Markdown string
   */
  setMarkdown(markdown: string): void {
    const newContent = this.parser.parseMarkdown(markdown);
    this.setContent(newContent);
  }

  /**
   * Set plain text content
   */
  setText(text: string): void {
    const newContent = this.parser.parsePlainText(text);
    this.setContent(newContent);
  }

  /**
   * Set rich text content
   */
  setContent(content: IRichTextContent): void {
    this.content = content;
    this.invalidateLayout();
    this.emit('content-changed', content);
  }

  /**
   * Get current content
   */
  getContent(): IRichTextContent | null {
    return this.content;
  }

  /**
   * Get plain text representation
   */
  getPlainText(): string {
    return this.content?.plainText || '';
  }

  /**
   * Export to HTML
   */
  exportToHTML(): string {
    if (!this.content) return '';
    
    let html = '';
    this.content.blocks.forEach(block => {
      const tagName = this.getHTMLTagForBlock(block.type);
      let blockContent = '';
      
      block.segments.forEach(segment => {
        let segmentHTML = this.escapeHTML(segment.text);
        
        // Apply inline styles
        if (segment.style.fontWeight === 'bold') {
          segmentHTML = `<strong>${segmentHTML}</strong>`;
        }
        if (segment.style.fontStyle === 'italic') {
          segmentHTML = `<em>${segmentHTML}</em>`;
        }
        if (segment.style.textDecoration === 'underline') {
          segmentHTML = `<u>${segmentHTML}</u>`;
        }
        if (segment.style.textDecoration === 'line-through') {
          segmentHTML = `<s>${segmentHTML}</s>`;
        }
        
        blockContent += segmentHTML;
      });
      
      html += `<${tagName}>${blockContent}</${tagName}>`;
    });
    
    return html;
  }

  /**
   * Render to canvas
   */
  render(context: IRichTextRenderContext): void {
    if (!this.content) return;
    
    this.ensureLayout();
    if (!this.layout) return;
    
    this.renderer.render(this.layout, context);
  }

  /**
   * Render visible viewport only (for performance)
   */
  renderViewport(
    context: IRichTextRenderContext,
    viewportY: number,
    viewportHeight: number
  ): void {
    if (!this.content) return;
    
    this.ensureLayout();
    if (!this.layout) return;
    
    this.renderer.renderViewport(this.layout, context, viewportY, viewportHeight);
  }

  /**
   * Get layout (creates if needed)
   */
  getLayout(): IRichTextLayout | null {
    this.ensureLayout();
    return this.layout;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<IRichTextConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.layoutEngine.updateConfig(this.config);
    this.invalidateLayout();
  }

  /**
   * Get character position from coordinates
   */
  getPositionFromCoordinates(x: number, y: number): IRichTextPosition | null {
    this.ensureLayout();
    if (!this.layout) return null;
    
    const result = this.layoutEngine.getCharacterPositionFromCoordinates(this.layout, x, y);
    if (!result) return null;
    
    return {
      characterIndex: result.characterIndex,
      blockIndex: result.blockIndex,
      segmentIndex: result.segmentIndex,
    };
  }

  /**
   * Get coordinates from character position
   */
  getCoordinatesFromPosition(position: IRichTextPosition): { x: number; y: number } | null {
    this.ensureLayout();
    if (!this.layout || !this.content) return null;
    
    // Find the word containing this character
    const word = this.layout.words.find(w => 
      position.characterIndex >= w.startIndex && 
      position.characterIndex <= w.endIndex
    );
    
    if (!word) return null;
    
    // Find the line containing this word
    const line = this.layout.lines.find(l => 
      l.words.includes(word)
    );
    
    if (!line) return null;
    
    // Calculate X position within the word
    let wordX = line.x;
    for (const lineWord of line.words) {
      if (lineWord === word) break;
      wordX += lineWord.width;
    }
    
    const relativeIndex = position.characterIndex - word.startIndex;
    const charX = this.metrics.getXFromCharacterIndex(word.text, relativeIndex, word.style);
    
    return {
      x: wordX + charX,
      y: line.y,
    };
  }

  /**
   * Set text selection
   */
  setSelection(selection: IRichTextSelection): void {
    this.selection = selection;
    this.updateCursor();
    this.emit('selection-changed', selection);
  }

  /**
   * Get current selection
   */
  getSelection(): IRichTextSelection | null {
    return this.selection;
  }

  /**
   * Clear selection
   */
  clearSelection(): void {
    this.selection = null;
    this.cursor = null;
    this.emit('selection-changed', null);
    this.emit('cursor-changed', null);
  }

  /**
   * Set cursor position
   */
  setCursor(position: IRichTextPosition): void {
    this.selection = {
      start: position,
      end: position,
      collapsed: true,
    };
    this.updateCursor();
    this.emit('selection-changed', this.selection);
  }

  /**
   * Get current cursor
   */
  getCursor(): IRichTextCursor | null {
    return this.cursor;
  }

  /**
   * Insert text at current cursor position
   */
  insertText(text: string, style?: Partial<ITextStyle>): void {
    if (!this.content || !this.selection) return;
    
    // TODO: Implement text insertion
    // This would involve:
    // 1. Finding the insertion point
    // 2. Splitting segments if needed
    // 3. Inserting new text with style
    // 4. Updating indices
    // 5. Re-layouting
    
    this.invalidateLayout();
    this.emit('content-changed', this.content);
  }

  /**
   * Delete selected text or character at cursor
   */
  deleteText(): void {
    if (!this.content || !this.selection) return;
    
    // TODO: Implement text deletion
    // Similar to insertText but removes content
    
    this.invalidateLayout();
    this.emit('content-changed', this.content);
  }

  /**
   * Apply formatting to current selection
   */
  applyFormatting(style: Partial<ITextStyle>): void {
    if (!this.content || !this.selection || this.selection.collapsed) return;
    
    // TODO: Implement formatting application
    // This would involve:
    // 1. Finding segments in selection range
    // 2. Splitting segments at selection boundaries
    // 3. Applying new style to selected segments
    // 4. Re-layouting
    
    this.invalidateLayout();
    this.emit('content-changed', this.content);
  }

  /**
   * Get dimensions of rendered content
   */
  getDimensions(): { width: number; height: number } {
    this.ensureLayout();
    return {
      width: this.layout?.totalWidth || 0,
      height: this.layout?.totalHeight || 0,
    };
  }

  /**
   * Clear all caches for memory management
   */
  clearCaches(): void {
    this.metrics.clearCache();
    this.renderer.clearCache();
  }

  /**
   * Get cache statistics for debugging
   */
  getCacheStats(): {
    metricsCache: number;
    rendererCache: { size: number; maxSize: number };
  } {
    return {
      metricsCache: this.metrics.getCacheSize(),
      rendererCache: this.renderer.getCacheStats(),
    };
  }

  /**
   * Add event listener
   */
  on(event: string, listener: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(listener);
  }

  /**
   * Remove event listener
   */
  off(event: string, listener: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Destroy the engine and clean up resources
   */
  destroy(): void {
    this.clearCaches();
    this.eventListeners.clear();
    this.content = null;
    this.layout = null;
    this.selection = null;
    this.cursor = null;
  }

  // Private methods

  private ensureLayout(): void {
    if (!this.layout && this.content) {
      this.layout = this.layoutEngine.layoutText(this.content.blocks);
      this.emit('layout-changed', this.layout);
    }
  }

  private invalidateLayout(): void {
    this.layout = null;
  }

  private updateCursor(): void {
    if (!this.selection || !this.selection.collapsed) {
      this.cursor = null;
      this.emit('cursor-changed', null);
      return;
    }

    const coords = this.getCoordinatesFromPosition(this.selection.start);
    if (!coords) return;

    // Find line height at cursor position
    this.ensureLayout();
    const line = this.layout?.lines.find(l => {
      const lineTop = l.y;
      const lineBottom = l.y + l.height;
      return coords.y >= lineTop && coords.y <= lineBottom;
    });

    this.cursor = {
      position: this.selection.start,
      x: coords.x,
      y: coords.y,
      height: line?.height || 20,
      visible: true,
    };

    this.emit('cursor-changed', this.cursor);
  }

  private emit(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => listener(data));
    }
  }

  private getHTMLTagForBlock(blockType: BlockType): string {
    switch (blockType) {
      case BlockType.Heading1: return 'h1';
      case BlockType.Heading2: return 'h2';
      case BlockType.Heading3: return 'h3';
      case BlockType.Quote: return 'blockquote';
      case BlockType.Code: return 'pre';
      case BlockType.ListItem: return 'li';
      default: return 'p';
    }
  }

  private escapeHTML(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}