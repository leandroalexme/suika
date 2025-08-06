import type {
  IRichTextLayout,
  ITextLine,
  IWord,
  ITextStyle,
  IRichTextRenderContext,
  BlockType,
  ListType,
} from './rich_text_types';

/**
 * High-performance rich text renderer for canvas
 * Uses caching and batching for optimal performance
 */
export class RichTextRenderer {
  private textCache = new Map<string, HTMLCanvasElement>();
  private maxCacheSize = 100;
  private lastStyle: ITextStyle | null = null;

  /**
   * Render complete rich text layout to canvas
   */
  render(layout: IRichTextLayout, context: IRichTextRenderContext): void {
    const { ctx, x, y, scale, opacity = 1 } = context;
    
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    
    if (opacity < 1) {
      ctx.globalAlpha = opacity;
    }

    // Render each line
    layout.lines.forEach(line => {
      this.renderLine(line, ctx, layout);
    });

    // Render list markers
    this.renderListMarkers(layout, ctx);

    ctx.restore();
  }

  /**
   * Render a single line of text
   */
  private renderLine(line: ITextLine, ctx: CanvasRenderingContext2D, _layout: IRichTextLayout): void {
    if (line.words.length === 0) return;

    let currentX = line.x;
    const baselineY = line.y + line.baseline;

    // Group consecutive words with same style for batching
    const styleGroups = this.groupWordsByStyle(line.words);

    styleGroups.forEach(group => {
      this.renderWordGroup(group, currentX, baselineY, ctx);
      currentX += group.words.reduce((sum, word) => sum + word.width, 0);
    });
  }

  /**
   * Group consecutive words with the same style for batch rendering
   */
  private groupWordsByStyle(words: IWord[]): Array<{ style: ITextStyle; words: IWord[]; text: string }> {
    const groups: Array<{ style: ITextStyle; words: IWord[]; text: string }> = [];
    let currentGroup: { style: ITextStyle; words: IWord[]; text: string } | null = null;

    words.forEach(word => {
      const isSameStyle = currentGroup && this.isSameStyle(currentGroup.style, word.style);
      
      if (!isSameStyle) {
        if (currentGroup) {
          groups.push(currentGroup);
        }
        currentGroup = {
          style: word.style,
          words: [word],
          text: word.text,
        };
      } else {
        currentGroup!.words.push(word);
        currentGroup!.text += word.text;
      }
    });

    if (currentGroup) {
      groups.push(currentGroup);
    }

    return groups;
  }

  /**
   * Render a group of words with the same style
   */
  private renderWordGroup(
    group: { style: ITextStyle; words: IWord[]; text: string },
    x: number,
    y: number,
    ctx: CanvasRenderingContext2D
  ): void {
    const { style, text } = group;

    // Apply style to context
    this.applyStyleToContext(style, ctx);

    // Render background if specified
    if (style.backgroundColor) {
      this.renderBackground(group.words, x, y, style, ctx);
    }

    // Use cached rendering for performance
    const cachedCanvas = this.getCachedText(text, style);
    if (cachedCanvas) {
      ctx.drawImage(cachedCanvas, x, y - this.getBaselineOffset(style));
    } else {
      // Fallback to direct rendering
      ctx.fillText(text, x, y);
      
      // Cache the rendered text for future use
      this.cacheText(text, style, ctx);
    }

    // Render text decorations
    this.renderTextDecorations(group.words, x, y, style, ctx);
  }

  /**
   * Get cached text or create new cached version
   */
  private getCachedText(text: string, style: ITextStyle): HTMLCanvasElement | null {
    const cacheKey = this.getCacheKey(text, style);
    return this.textCache.get(cacheKey) || null;
  }

  /**
   * Cache rendered text for performance
   */
  private cacheText(text: string, style: ITextStyle, _ctx: CanvasRenderingContext2D): void {
    if (this.textCache.size >= this.maxCacheSize) {
      // Remove oldest entries
      const entries = Array.from(this.textCache.entries());
      const toRemove = entries.slice(0, Math.floor(this.maxCacheSize * 0.2));
      toRemove.forEach(([key]) => this.textCache.delete(key));
    }

    // Create offscreen canvas for caching
    const canvas = document.createElement('canvas');
    const cacheCtx = canvas.getContext('2d')!;
    
    // Apply style and measure text
    this.applyStyleToContext(style, cacheCtx);
    const metrics = cacheCtx.measureText(text);
    
    // Size canvas to fit text
    canvas.width = Math.ceil(metrics.width);
    canvas.height = Math.ceil(metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent);
    
    // Re-apply style after canvas resize
    this.applyStyleToContext(style, cacheCtx);
    
    // Render text to cache
    cacheCtx.fillText(text, 0, metrics.fontBoundingBoxAscent);
    
    // Store in cache
    const cacheKey = this.getCacheKey(text, style);
    this.textCache.set(cacheKey, canvas);
  }

  /**
   * Apply text style to canvas context
   */
  private applyStyleToContext(style: ITextStyle, ctx: CanvasRenderingContext2D): void {
    // Only update context if style has changed
    if (!this.isSameStyle(this.lastStyle, style)) {
      const fontFamily = style.fontFamily || 'sans-serif';
      const fontSize = style.fontSize || 16;
      const fontWeight = style.fontWeight || 'normal';
      const fontStyle = style.fontStyle || 'normal';
      
      ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
      ctx.fillStyle = style.color || '#000000';
      ctx.fontKerning = 'none';
      
      this.lastStyle = { ...style };
    }
  }

  /**
   * Render background for text
   */
  private renderBackground(
    words: IWord[],
    x: number,
    y: number,
    style: ITextStyle,
    ctx: CanvasRenderingContext2D
  ): void {
    if (!style.backgroundColor) return;

    const totalWidth = words.reduce((sum, word) => sum + word.width, 0);
    const maxHeight = Math.max(...words.map(word => word.height));
    const maxAscent = Math.max(...words.map(word => word.ascent));

    ctx.save();
    ctx.fillStyle = style.backgroundColor;
    ctx.fillRect(x, y - maxAscent, totalWidth, maxHeight);
    ctx.restore();
  }

  /**
   * Render text decorations (underline, strikethrough)
   */
  private renderTextDecorations(
    words: IWord[],
    x: number,
    y: number,
    style: ITextStyle,
    ctx: CanvasRenderingContext2D
  ): void {
    if (!style.textDecoration || style.textDecoration === 'none') return;

    const totalWidth = words.reduce((sum, word) => sum + word.width, 0);
    const fontSize = style.fontSize || 16;
    const lineWidth = Math.max(1, fontSize / 16);

    ctx.save();
    ctx.strokeStyle = style.color || '#000000';
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';

    ctx.beginPath();

    switch (style.textDecoration) {
      case 'underline':
        const underlineY = y + fontSize * 0.1;
        ctx.moveTo(x, underlineY);
        ctx.lineTo(x + totalWidth, underlineY);
        break;
        
      case 'line-through':
        const strikeY = y - fontSize * 0.3;
        ctx.moveTo(x, strikeY);
        ctx.lineTo(x + totalWidth, strikeY);
        break;
    }

    ctx.stroke();
    ctx.restore();
  }

  /**
   * Render list markers (bullets, numbers)
   */
  private renderListMarkers(layout: IRichTextLayout, ctx: CanvasRenderingContext2D): void {
    const renderedBlocks = new Set<number>();
    
    layout.lines.forEach(line => {
      if (line.words.length === 0) return;
      
      const blockIndex = line.blockIndex;
      const block = layout.blocks[blockIndex];
      
      if (block.type === BlockType.ListItem && !renderedBlocks.has(blockIndex)) {
        this.renderListMarker(block, line, ctx, layout);
        renderedBlocks.add(blockIndex);
      }
    });
  }

  /**
   * Render a single list marker
   */
  private renderListMarker(
    block: any,
    line: ITextLine,
    ctx: CanvasRenderingContext2D,
    layout: IRichTextLayout
  ): void {
    // const listLevel = block.listLevel || 0;
    const listType = block.listType;
    const defaultStyle = layout.words.length > 0 ? layout.words[0].style : {};
    
    ctx.save();
    this.applyStyleToContext(defaultStyle, ctx);

    const fontSize = defaultStyle.fontSize || 16;
    const markerX = line.x - fontSize * 1.5;
    const markerY = line.y + line.baseline;

    if (listType === ListType.Ordered) {
      // Render number (simplified - would need proper numbering logic)
      const itemNumber = this.getListItemNumber(block, layout);
      ctx.fillText(`${itemNumber}.`, markerX, markerY);
    } else {
      // Render bullet
      const bulletSize = fontSize * 0.15;
      ctx.beginPath();
      ctx.arc(markerX + bulletSize, markerY - fontSize * 0.3, bulletSize, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  /**
   * Get list item number (simplified implementation)
   */
  private getListItemNumber(_block: any, _layout: IRichTextLayout): number {
    // Simplified - would need proper list numbering logic
    return 1;
  }

  /**
   * Check if two styles are the same
   */
  private isSameStyle(style1: ITextStyle | null, style2: ITextStyle): boolean {
    if (!style1) return false;
    
    return (
      style1.fontFamily === style2.fontFamily &&
      style1.fontSize === style2.fontSize &&
      style1.fontWeight === style2.fontWeight &&
      style1.fontStyle === style2.fontStyle &&
      style1.color === style2.color &&
      style1.backgroundColor === style2.backgroundColor &&
      style1.textDecoration === style2.textDecoration
    );
  }

  /**
   * Generate cache key for text and style
   */
  private getCacheKey(text: string, style: ITextStyle): string {
    return `${text}|${style.fontFamily || 'sans-serif'}|${style.fontSize || 16}|${style.fontWeight || 'normal'}|${style.fontStyle || 'normal'}|${style.color || '#000000'}`;
  }

  /**
   * Get baseline offset for a style
   */
  private getBaselineOffset(style: ITextStyle): number {
    // Create temporary context to measure baseline
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    this.applyStyleToContext(style, ctx);
    const metrics = ctx.measureText('Mg');
    return metrics.fontBoundingBoxAscent;
  }

  /**
   * Clear the text cache
   */
  clearCache(): void {
    this.textCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; maxSize: number } {
    return {
      size: this.textCache.size,
      maxSize: this.maxCacheSize,
    };
  }

  /**
   * Set maximum cache size
   */
  setMaxCacheSize(size: number): void {
    this.maxCacheSize = size;
    
    // Clean up if current cache is too large
    if (this.textCache.size > size) {
      const entries = Array.from(this.textCache.entries());
      const toKeep = entries.slice(-size);
      this.textCache.clear();
      toKeep.forEach(([key, value]) => {
        this.textCache.set(key, value);
      });
    }
  }

  /**
   * Render only visible portion of the layout (viewport culling)
   */
  renderViewport(
    layout: IRichTextLayout,
    context: IRichTextRenderContext,
    viewportY: number,
    viewportHeight: number
  ): void {
    const { ctx, x, y, scale, opacity = 1 } = context;
    
    // Calculate visible lines
    const visibleLines = layout.lines.filter(line => {
      const lineTop = line.y;
      const lineBottom = line.y + line.height;
      return lineBottom >= viewportY && lineTop <= viewportY + viewportHeight;
    });

    if (visibleLines.length === 0) return;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    
    if (opacity < 1) {
      ctx.globalAlpha = opacity;
    }

    // Render only visible lines
    visibleLines.forEach(line => {
      this.renderLine(line, ctx, layout);
    });

    // Render list markers for visible lines
    this.renderListMarkersForLines(visibleLines, layout, ctx);

    ctx.restore();
  }

  /**
   * Render list markers for specific lines only
   */
  private renderListMarkersForLines(
    lines: ITextLine[],
    layout: IRichTextLayout,
    ctx: CanvasRenderingContext2D
  ): void {
    const renderedBlocks = new Set<number>();
    
    lines.forEach(line => {
      if (line.words.length === 0) return;
      
      const blockIndex = line.blockIndex;
      const block = layout.blocks[blockIndex];
      
      if (block.type === BlockType.ListItem && !renderedBlocks.has(blockIndex)) {
        this.renderListMarker(block, line, ctx, layout);
        renderedBlocks.add(blockIndex);
      }
    });
  }
}