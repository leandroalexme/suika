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
  ITextSegment,
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
   * Convenience: get IRichTextPosition from a global character index
   */
  getPositionFromCharacterIndex(characterIndex: number): IRichTextPosition | null {
    this.ensureLayout();
    if (!this.layout) return null;

    // Find the word containing this character
    const word = this.layout.words.find(
      (w) => characterIndex >= w.startIndex && characterIndex <= w.endIndex,
    );
    if (!word) return null;

    // Resolve segment and block index from word
    return {
      characterIndex,
      blockIndex: word.blockIndex,
      segmentIndex: word.segmentIndex,
    };
  }

  /**
   * Insert text at current cursor/selection
   */
  insertText(text: string, style?: Partial<ITextStyle>): void {
    if (!this.content || !this.selection) return;

    const isCollapsed = this.selection.collapsed;
    const startChar = this.selection.start.characterIndex;
    const endChar = isCollapsed ? startChar : this.selection.end.characterIndex;
    const insertStyle: ITextStyle = { ...this.config.defaultStyle, ...(style || {}) };

    // First delete selected text if any
    if (!isCollapsed) {
      this.deleteRange(Math.min(startChar, endChar), Math.max(startChar, endChar));
    }

    // Recompute after potential deletion
    if (!this.content) return;

    // Insert into block/segment where startChar falls
    const { blockIndex, segmentIndex, offsetInSegment } = this.findSegmentByCharIndex(
      startChar,
    );

    if (blockIndex < 0 || segmentIndex < 0) {
      // If no segment found (empty content), create first block/segment
      const newSegment = {
        text,
        style: insertStyle,
        startIndex: 0,
        endIndex: text.length,
      } as const;
      const newBlock = {
        type: BlockType.Paragraph,
        segments: [newSegment],
        startIndex: 0,
        endIndex: text.length,
      };
      this.content.blocks = [newBlock];
      this.updatePlainTextAndCounts();
      this.invalidateLayout();
      const newPos = this.getPositionFromCharacterIndex(text.length);
      if (newPos) this.setCursor(newPos);
      this.emit('content-changed', this.content);
      return;
    }

    const block = this.content.blocks[blockIndex];
    const seg = block.segments[segmentIndex];

    const beforeText = seg.text.slice(0, offsetInSegment);
    const afterText = seg.text.slice(offsetInSegment);

    const beforeSeg = beforeText
      ? {
          text: beforeText,
          style: { ...seg.style },
          startIndex: seg.startIndex,
          endIndex: seg.startIndex + beforeText.length,
        }
      : null;

    const insertSeg = {
      text,
      style: insertStyle,
      startIndex: (beforeSeg ? beforeSeg.endIndex : seg.startIndex),
      endIndex: (beforeSeg ? beforeSeg.endIndex : seg.startIndex) + text.length,
    };

    const afterSeg = afterText
      ? {
          text: afterText,
          style: { ...seg.style },
          startIndex: insertSeg.endIndex,
          endIndex: insertSeg.endIndex + afterText.length,
        }
      : null;

    // Replace in block.segments
    const newSegments = [
      ...block.segments.slice(0, segmentIndex),
      ...(beforeSeg ? [beforeSeg] : []),
      insertSeg,
      ...(afterSeg ? [afterSeg] : []),
      ...block.segments.slice(segmentIndex + 1),
    ];

    // Update indices for subsequent segments in this block
    const delta = text.length;
    this.bumpFollowingSegmentsIndices(blockIndex, segmentIndex + (beforeSeg ? 1 : 0) + 1, delta, newSegments);

    block.segments = newSegments;

    // Update block indices and following blocks
    this.bumpFollowingBlocksIndices(blockIndex, delta);

    // Update cached plain text and counts
    this.updatePlainTextAndCounts();

    // Invalidate layout and move cursor
    this.invalidateLayout();
    const newCursorIndex = startChar + text.length;
    const pos = this.getPositionFromCharacterIndex(newCursorIndex);
    if (pos) this.setCursor(pos);

    this.emit('content-changed', this.content);
  }

  /**
   * Delete selected text or a single character (direction optional)
   */
  deleteText(direction: 'backward' | 'forward' = 'backward'): void {
    if (!this.content || !this.selection) return;

    const isCollapsed = this.selection.collapsed;
    let startChar = this.selection.start.characterIndex;
    let endChar = this.selection.end.characterIndex;

    if (isCollapsed) {
      if (direction === 'backward') {
        if (startChar <= 0) return;
        startChar = startChar - 1;
        endChar = startChar + 1;
      } else {
        endChar = endChar + 1;
      }
    } else {
      const left = Math.min(startChar, endChar);
      const right = Math.max(startChar, endChar);
      startChar = left;
      endChar = right;
    }

    this.deleteRange(startChar, endChar);

    // Move cursor
    const newPos = this.getPositionFromCharacterIndex(startChar);
    if (newPos) this.setCursor(newPos);

    this.emit('content-changed', this.content);
  }

  /**
   * Apply formatting to current selection (basic: per-segment split and style merge)
   */
  applyFormatting(style: Partial<ITextStyle>): void {
    if (!this.content || !this.selection || this.selection.collapsed) return;

    const left = Math.min(
      this.selection.start.characterIndex,
      this.selection.end.characterIndex,
    );
    const right = Math.max(
      this.selection.start.characterIndex,
      this.selection.end.characterIndex,
    );

    // Walk through blocks/segments and split at boundaries, then apply style to middle segments
    let remainingStart = left;
    let remainingEnd = right;

    for (let b = 0; b < this.content.blocks.length; b++) {
      const block = this.content.blocks[b];
      const segments = block.segments;
      const newSegments: ITextSegment[] = [];

      for (let s = 0; s < segments.length; s++) {
        const seg: ITextSegment = segments[s];
        if (seg.endIndex <= remainingStart || seg.startIndex >= remainingEnd) {
          // No overlap
          newSegments.push(seg);
          continue;
        }

        // Overlap exists. Determine parts
        const segLeft = Math.max(seg.startIndex, remainingStart);
        const segRight = Math.min(seg.endIndex, remainingEnd);

        const beforeLen = segLeft - seg.startIndex;
        const middleLen = segRight - segLeft;
        const afterLen = seg.endIndex - segRight;

        if (beforeLen > 0) {
          newSegments.push({
            text: seg.text.slice(0, beforeLen),
            style: { ...seg.style },
            startIndex: seg.startIndex,
            endIndex: seg.startIndex + beforeLen,
          });
        }

        if (middleLen > 0) {
          newSegments.push({
            text: seg.text.slice(beforeLen, beforeLen + middleLen),
            style: { ...seg.style, ...style },
            startIndex: segLeft,
            endIndex: segRight,
          });
        }

        if (afterLen > 0) {
          newSegments.push({
            text: seg.text.slice(seg.text.length - afterLen),
            style: { ...seg.style },
            startIndex: segRight,
            endIndex: seg.endIndex,
          });
        }
      }

      block.segments = newSegments;
    }

    // No character count change, only style. Keep indices; ensure layout updated
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

  // Helpers for editing
  private findSegmentByCharIndex(characterIndex: number): { blockIndex: number; segmentIndex: number; offsetInSegment: number } {
    if (!this.content) return { blockIndex: -1, segmentIndex: -1, offsetInSegment: 0 };

    for (let b = 0; b < this.content.blocks.length; b++) {
      const block = this.content.blocks[b];
      for (let s = 0; s < block.segments.length; s++) {
        const seg = block.segments[s];
        if (characterIndex >= seg.startIndex && characterIndex <= seg.endIndex) {
          return { blockIndex: b, segmentIndex: s, offsetInSegment: characterIndex - seg.startIndex };
        }
      }
    }
    return { blockIndex: -1, segmentIndex: -1, offsetInSegment: 0 };
  }

  private bumpFollowingSegmentsIndices(
    blockIndex: number,
    startSegmentIdxInNewList: number,
    delta: number,
    newSegmentsForThisBlock: { startIndex: number; endIndex: number }[],
  ) {
    // Adjust indices for segments after the insertion point within this block
    for (let i = startSegmentIdxInNewList; i < newSegmentsForThisBlock.length; i++) {
      const seg = newSegmentsForThisBlock[i];
      seg.startIndex += delta;
      seg.endIndex += delta;
    }
  }

  private bumpFollowingBlocksIndices(blockIndex: number, delta: number) {
    if (!this.content) return;
    // Current block endIndex increases
    for (let b = blockIndex; b < this.content.blocks.length; b++) {
      const block = this.content.blocks[b];
      block.endIndex += delta;
      // Also shift segment indices in subsequent blocks
      if (b > blockIndex) {
        for (const seg of block.segments) {
          seg.startIndex += delta;
          seg.endIndex += delta;
        }
      }
    }
  }

  private updatePlainTextAndCounts() {
    if (!this.content) return;
    let plain = '';
    let total = 0;
    this.content.blocks.forEach((block, idx) => {
      block.segments.forEach((seg) => {
        plain += seg.text;
        total += seg.text.length;
      });
      if (idx !== this.content!.blocks.length - 1) plain += '\n';
    });
    this.content.totalCharacterCount = total;
    this.content.plainText = plain;
  }

  private deleteRange(startChar: number, endChar: number) {
    if (!this.content || startChar >= endChar) return;

    const { blockIndex: startBlockIdx, segmentIndex: startSegIdx, offsetInSegment: startOffset } =
      this.findSegmentByCharIndex(startChar);
    const { blockIndex: endBlockIdx, segmentIndex: endSegIdx, offsetInSegment: endOffset } =
      this.findSegmentByCharIndex(endChar);

    if (startBlockIdx < 0 || startSegIdx < 0 || endBlockIdx < 0 || endSegIdx < 0) return;

    // Single block case (handle first)
    if (startBlockIdx === endBlockIdx) {
      const block = this.content.blocks[startBlockIdx];
      const segs: ITextSegment[] = block.segments;
      const seg: ITextSegment = segs[startSegIdx];

      if (startSegIdx === endSegIdx) {
        // Deleting inside one segment
        const before = seg.text.slice(0, startOffset);
        const after = seg.text.slice(endOffset);
        const newSegs: ITextSegment[] = [
          ...(before
            ? [{ text: before, style: { ...seg.style }, startIndex: seg.startIndex, endIndex: seg.startIndex + before.length }]
            : []),
          ...(after
            ? [{ text: after, style: { ...seg.style }, startIndex: seg.startIndex + before.length, endIndex: seg.startIndex + before.length + after.length }]
            : []),
        ];
        const removedLen = endChar - startChar;
        const delta = -removedLen;

        // Replace segment range
        block.segments = [
          ...segs.slice(0, startSegIdx),
          ...newSegs,
          ...segs.slice(startSegIdx + 1),
        ];

        // Shift following segments/blocks
        this.bumpFollowingSegmentsIndices(startBlockIdx, startSegIdx + newSegs.length, delta, block.segments as any);
        this.bumpFollowingBlocksIndices(startBlockIdx, delta);
      } else {
        // Deleting across multiple segments within the same block
        const startSeg: ITextSegment = segs[startSegIdx];
        const endSeg: ITextSegment = segs[endSegIdx];
        const left = startSeg.text.slice(0, startOffset);
        const right = endSeg.text.slice(endOffset);

        const merged: ITextSegment[] = [
          ...(left
            ? [{ text: left, style: { ...startSeg.style }, startIndex: startSeg.startIndex, endIndex: startSeg.startIndex + left.length }]
            : []),
          ...(right
            ? [{
                  text: right,
                  style: { ...endSeg.style },
                  startIndex: (left ? startSeg.startIndex + left.length : startSeg.startIndex),
                  endIndex: (left ? startSeg.startIndex + left.length : startSeg.startIndex) + right.length,
                }]
            : []),
        ];

        const removedLen = endChar - startChar;
        const delta = -removedLen;

        block.segments = [
          ...segs.slice(0, startSegIdx),
          ...merged,
          ...segs.slice(endSegIdx + 1),
        ];

        this.bumpFollowingSegmentsIndices(startBlockIdx, startSegIdx + merged.length, delta, block.segments as any);
        this.bumpFollowingBlocksIndices(startBlockIdx, delta);
      }
    } else {
      // Multi-block deletion (simplified): remove content across blocks, merge start and end remnants
      const startBlock = this.content.blocks[startBlockIdx];
      const endBlock = this.content.blocks[endBlockIdx];

      const startSegs: ITextSegment[] = startBlock.segments;
      const endSegs: ITextSegment[] = endBlock.segments;

      const leftSeg: ITextSegment = startSegs[startSegIdx];
      const rightSeg: ITextSegment = endSegs[endSegIdx];

      const leftText = leftSeg.text.slice(0, startOffset);
      const rightText = rightSeg.text.slice(endOffset);

      // New segments for start block up to startSegIdx-1 plus leftText and rightText merged as needed
      const mergedSegs: ITextSegment[] = [
        ...startSegs.slice(0, startSegIdx),
        ...(leftText
          ? [{ text: leftText, style: { ...leftSeg.style }, startIndex: leftSeg.startIndex, endIndex: leftSeg.startIndex + leftText.length }]
          : []),
        ...(rightText
          ? [{
                text: rightText,
                style: { ...rightSeg.style },
                startIndex: (leftText ? leftSeg.startIndex + leftText.length : leftSeg.startIndex),
                endIndex: (leftText ? leftSeg.startIndex + leftText.length : leftSeg.startIndex) + rightText.length,
              }]
          : []),
      ];

      startBlock.segments = mergedSegs;

      // Remove blocks between and including end block (except keep start block)
      const removedLen = endChar - startChar;
      const delta = -removedLen;

      // Remove segments from startSegIdx+1 to end in start block, and all blocks between start+1 and end-1, and all segments up to endSegIdx in end block
      // Simplify: rebuild blocks array as: blocks before startBlockIdx, startBlock(updated), blocks after endBlockIdx
      this.content.blocks = [
        ...this.content.blocks.slice(0, startBlockIdx + 1),
        ...this.content.blocks.slice(endBlockIdx + 1),
      ];

      // Shift indices in start block's remaining segments
      this.bumpFollowingSegmentsIndices(startBlockIdx, mergedSegs.length, delta, startBlock.segments as any);
      // Shift following blocks
      this.bumpFollowingBlocksIndices(startBlockIdx, delta);
    }

    // Update plain text & counts and invalidate layout
    this.updatePlainTextAndCounts();
    this.invalidateLayout();
  }
}