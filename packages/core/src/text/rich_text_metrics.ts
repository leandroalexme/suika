import type {
  ITextStyle,
  IWord,
  IWordMetrics,
  ITextSegment,
  ITextBlock,
} from './rich_text_types';

/**
 * Canvas-based text metrics calculator
 * Uses offscreen canvas for performance optimization
 */
export class RichTextMetrics {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private metricsCache = new Map<string, IWordMetrics>();
  
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 1;
    this.canvas.height = 1;
    this.ctx = this.canvas.getContext('2d')!;
    this.ctx.fontKerning = 'none'; // Disable kerning for consistent measurements
  }

  /**
   * Calculate metrics for a single word
   */
  calculateWordMetrics(text: string, style: ITextStyle): IWordMetrics {
    const cacheKey = this.getCacheKey(text, style);
    
    if (this.metricsCache.has(cacheKey)) {
      return this.metricsCache.get(cacheKey)!;
    }

    this.applyStyle(style);
    const textMetrics = this.ctx.measureText(text);
    
    const metrics: IWordMetrics = {
      width: textMetrics.width,
      height: textMetrics.fontBoundingBoxAscent + textMetrics.fontBoundingBoxDescent,
      ascent: textMetrics.fontBoundingBoxAscent,
      descent: textMetrics.fontBoundingBoxDescent,
    };

    this.metricsCache.set(cacheKey, metrics);
    return metrics;
  }

  /**
   * Split text segments into words with metrics
   */
  segmentsToWords(blocks: ITextBlock[]): IWord[] {
    const words: IWord[] = [];
    
    blocks.forEach((block, blockIndex) => {
      block.segments.forEach((segment, segmentIndex) => {
        const segmentWords = this.splitSegmentIntoWords(segment, blockIndex, segmentIndex);
        words.push(...segmentWords);
      });
    });

    return words;
  }

  /**
   * Split a single segment into words
   */
  private splitSegmentIntoWords(segment: ITextSegment, blockIndex: number, segmentIndex: number): IWord[] {
    const words: IWord[] = [];
    const text = segment.text;
    
    // Handle empty or whitespace-only segments
    if (!text.trim()) {
      if (text.length > 0) {
        const metrics = this.calculateWordMetrics(text, segment.style);
        words.push({
          text,
          style: segment.style,
          width: metrics.width,
          height: metrics.height,
          ascent: metrics.ascent,
          descent: metrics.descent,
          startIndex: segment.startIndex,
          endIndex: segment.endIndex,
          segmentIndex,
          blockIndex,
        });
      }
      return words;
    }

    // Split by word boundaries, keeping spaces
    const wordRegex = /(\S+|\s+)/g;
    let match;
    let currentIndex = segment.startIndex;

    while ((match = wordRegex.exec(text)) !== null) {
      const wordText = match[0];
      const metrics = this.calculateWordMetrics(wordText, segment.style);
      
      words.push({
        text: wordText,
        style: segment.style,
        width: metrics.width,
        height: metrics.height,
        ascent: metrics.ascent,
        descent: metrics.descent,
        startIndex: currentIndex,
        endIndex: currentIndex + wordText.length,
        segmentIndex,
        blockIndex,
      });

      currentIndex += wordText.length;
    }

    return words;
  }

  /**
   * Calculate line height for a given style
   */
  calculateLineHeight(style: ITextStyle): number {
    const fontSize = style.fontSize || 16;
    const lineHeight = style.lineHeight || 1.2;
    return fontSize * lineHeight;
  }

  /**
   * Calculate character width at specific position
   */
  calculateCharacterWidth(text: string, position: number, style: ITextStyle): number {
    if (position >= text.length) return 0;
    
    const char = text[position];
    const metrics = this.calculateWordMetrics(char, style);
    return metrics.width;
  }

  /**
   * Find character position from x coordinate within text
   */
  getCharacterIndexFromX(text: string, x: number, style: ITextStyle): number {
    this.applyStyle(style);
    
    let currentX = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const charWidth = this.ctx.measureText(char).width;
      
      if (currentX + charWidth / 2 > x) {
        return i;
      }
      
      currentX += charWidth;
    }
    
    return text.length;
  }

  /**
   * Get x coordinate for character position
   */
  getXFromCharacterIndex(text: string, index: number, style: ITextStyle): number {
    if (index <= 0) return 0;
    if (index >= text.length) {
      const metrics = this.calculateWordMetrics(text, style);
      return metrics.width;
    }

    const substring = text.substring(0, index);
    const metrics = this.calculateWordMetrics(substring, style);
    return metrics.width;
  }

  /**
   * Check if a word can fit on current line
   */
  canWordFitOnLine(word: IWord, currentLineWidth: number, maxWidth: number): boolean {
    return currentLineWidth + word.width <= maxWidth;
  }

  /**
   * Break a long word that doesn't fit on a line
   */
  breakWord(word: IWord, maxWidth: number): IWord[] {
    if (word.width <= maxWidth) {
      return [word];
    }

    const words: IWord[] = [];
    const text = word.text;
    let currentText = '';
    let currentWidth = 0;
    let startIndex = word.startIndex;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const charWidth = this.calculateCharacterWidth(char, 0, word.style);
      
      if (currentWidth + charWidth > maxWidth && currentText.length > 0) {
        // Create word with current text
        const metrics = this.calculateWordMetrics(currentText, word.style);
        words.push({
          text: currentText,
          style: word.style,
          width: metrics.width,
          height: metrics.height,
          ascent: metrics.ascent,
          descent: metrics.descent,
          startIndex,
          endIndex: startIndex + currentText.length,
          segmentIndex: word.segmentIndex,
          blockIndex: word.blockIndex,
        });
        
        // Reset for next word part
        startIndex += currentText.length;
        currentText = char;
        currentWidth = charWidth;
      } else {
        currentText += char;
        currentWidth += charWidth;
      }
    }

    // Add remaining text
    if (currentText.length > 0) {
      const metrics = this.calculateWordMetrics(currentText, word.style);
      words.push({
        text: currentText,
        style: word.style,
        width: metrics.width,
        height: metrics.height,
        ascent: metrics.ascent,
        descent: metrics.descent,
        startIndex,
        endIndex: startIndex + currentText.length,
        segmentIndex: word.segmentIndex,
        blockIndex: word.blockIndex,
      });
    }

    return words;
  }

  /**
   * Apply text style to canvas context
   */
  private applyStyle(style: ITextStyle): void {
    const fontFamily = style.fontFamily || 'sans-serif';
    const fontSize = style.fontSize || 16;
    const fontWeight = style.fontWeight || 'normal';
    const fontStyle = style.fontStyle || 'normal';
    
    this.ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
    this.ctx.fillStyle = style.color || '#000000';
  }

  /**
   * Generate cache key for metrics
   */
  private getCacheKey(text: string, style: ITextStyle): string {
    const key = `${text}|${style.fontFamily || 'sans-serif'}|${style.fontSize || 16}|${style.fontWeight || 'normal'}|${style.fontStyle || 'normal'}`;
    return key;
  }

  /**
   * Clear metrics cache
   */
  clearCache(): void {
    this.metricsCache.clear();
  }

  /**
   * Get cache size for debugging
   */
  getCacheSize(): number {
    return this.metricsCache.size;
  }

  /**
   * Calculate baseline offset for a style
   */
  getBaselineOffset(style: ITextStyle): number {
    const metrics = this.calculateWordMetrics('Mg', style); // Use 'Mg' for baseline calculation
    return metrics.ascent;
  }

  /**
   * Estimate memory usage of cache
   */
  getEstimatedCacheMemoryUsage(): number {
    let totalSize = 0;
    this.metricsCache.forEach((_value, key) => {
      totalSize += key.length * 2; // Approximate UTF-16 character size
      totalSize += 32; // Approximate object overhead for IWordMetrics
    });
    return totalSize;
  }

  /**
   * Clean up cache if it gets too large
   */
  cleanupCache(maxSize: number = 1000): void {
    if (this.metricsCache.size > maxSize) {
      const entries = Array.from(this.metricsCache.entries());
      // Remove oldest entries (simple FIFO)
      const keepCount = Math.floor(maxSize * 0.8);
      const toKeep = entries.slice(-keepCount);
      
      this.metricsCache.clear();
      toKeep.forEach(([key, value]) => {
        this.metricsCache.set(key, value);
      });
    }
  }
}