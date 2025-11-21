import {
  ITextBlock,
  IWord,
  ITextLine,
  IRichTextLayout,
  IRichTextConfig,
  BlockType,
  ListType,
} from './rich_text_types';
import { RichTextMetrics } from './rich_text_metrics';

/**
 * Layout engine for rich text
 * Implements the Miro approach: arrange words into lines with proper spacing
 */
export class RichTextLayoutEngine {
  private metrics: RichTextMetrics;
  private config: IRichTextConfig;

  constructor(metrics: RichTextMetrics, config: IRichTextConfig) {
    this.metrics = metrics;
    this.config = config;
  }

  /**
   * Create complete layout from blocks
   */
  layoutText(blocks: ITextBlock[]): IRichTextLayout {
    // Step 1: Convert segments to words
    const words = this.metrics.segmentsToWords(blocks);

    // Step 2: Arrange words into lines
    const lines = this.arrangeWordsIntoLines(words, blocks);

    // Step 3: Calculate total dimensions
    const { totalWidth, totalHeight } = this.calculateTotalDimensions(lines);

    return {
      lines,
      totalWidth,
      totalHeight,
      blocks,
      words,
    };
  }

  /**
   * Arrange words into lines with proper wrapping and spacing
   */
  private arrangeWordsIntoLines(words: IWord[], blocks: ITextBlock[]): ITextLine[] {
    const lines: ITextLine[] = [];
    const maxWidth = this.config.maxWidth || Infinity;
    const lineSpacing = this.config.lineSpacing || 1.2;
    const paragraphSpacing = this.config.paragraphSpacing || 8;
    const listIndentation = this.config.listIndentation || 20;

    let currentY = 0;
    let currentBlockIndex = -1;
    let wordsInCurrentBlock: IWord[] = [];

    // Group words by block
    const wordsByBlock = new Map<number, IWord[]>();
    words.forEach(word => {
      if (!wordsByBlock.has(word.blockIndex)) {
        wordsByBlock.set(word.blockIndex, []);
      }
      wordsByBlock.get(word.blockIndex)!.push(word);
    });

    // Process each block
    blocks.forEach((block, blockIndex) => {
      const blockWords = wordsByBlock.get(blockIndex) || [];
      
      if (blockWords.length === 0) {
        // Empty block, still add spacing
        const blockLines = this.createEmptyBlockLine(block, currentY, blockIndex);
        lines.push(...blockLines);
        currentY += this.getBlockSpacing(block) + paragraphSpacing;
        return;
      }

      // Calculate block positioning
      const blockX = this.calculateBlockX(block, listIndentation);
      const blockMaxWidth = maxWidth - blockX;

      // Create lines for this block
      const blockLines = this.createLinesForBlock(
        blockWords,
        block,
        blockIndex,
        blockX,
        currentY,
        blockMaxWidth,
        lineSpacing
      );

      lines.push(...blockLines);

      // Update Y position for next block
      if (blockLines.length > 0) {
        const lastLine = blockLines[blockLines.length - 1];
        currentY = lastLine.y + lastLine.height + paragraphSpacing;
      } else {
        currentY += this.getBlockSpacing(block) + paragraphSpacing;
      }
    });

    return lines;
  }

  /**
   * Create lines for a single block
   */
  private createLinesForBlock(
    words: IWord[],
    block: ITextBlock,
    blockIndex: number,
    blockX: number,
    startY: number,
    maxWidth: number,
    lineSpacing: number
  ): ITextLine[] {
    const lines: ITextLine[] = [];
    let currentLine: IWord[] = [];
    let currentLineWidth = 0;
    let currentY = startY;

    // Add list marker width to first line if it's a list item
    let firstLineExtraWidth = 0;
    if (block.type === BlockType.ListItem) {
      firstLineExtraWidth = this.calculateListMarkerWidth(block);
    }

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const isFirstLine = lines.length === 0;
      const effectiveMaxWidth = isFirstLine ? maxWidth - firstLineExtraWidth : maxWidth;
      
      // Check if word fits on current line
      if (this.metrics.canWordFitOnLine(word, currentLineWidth, effectiveMaxWidth)) {
        currentLine.push(word);
        currentLineWidth += word.width;
      } else {
        // Word doesn't fit, start new line
        if (currentLine.length > 0) {
          // Create line from current words
          const line = this.createLine(
            currentLine,
            blockX + (isFirstLine ? firstLineExtraWidth : 0),
            currentY,
            blockIndex,
            block.alignment || this.config.textAlign || 'left',
            effectiveMaxWidth
          );
          lines.push(line);
          currentY += line.height * lineSpacing;
        }

        // Handle word that doesn't fit
        if (word.width > effectiveMaxWidth && this.config.wordWrap) {
          // Break long word
          const brokenWords = this.metrics.breakWord(word, effectiveMaxWidth);
          
          // Add first part to new line
          currentLine = [brokenWords[0]];
          currentLineWidth = brokenWords[0].width;

          // Add remaining parts as separate lines
          for (let j = 1; j < brokenWords.length; j++) {
            if (currentLine.length > 0) {
              const line = this.createLine(
                currentLine,
                blockX,
                currentY,
                blockIndex,
                block.alignment || this.config.textAlign || 'left',
                maxWidth
              );
              lines.push(line);
              currentY += line.height * lineSpacing;
            }
            
            currentLine = [brokenWords[j]];
            currentLineWidth = brokenWords[j].width;
          }
        } else {
          // Start new line with this word
          currentLine = [word];
          currentLineWidth = word.width;
        }
      }
    }

    // Create final line if there are remaining words
    if (currentLine.length > 0) {
      const isFirstLine = lines.length === 0;
      const line = this.createLine(
        currentLine,
        blockX + (isFirstLine ? firstLineExtraWidth : 0),
        currentY,
        blockIndex,
        block.alignment || this.config.textAlign || 'left',
        isFirstLine ? maxWidth - firstLineExtraWidth : maxWidth
      );
      lines.push(line);
    }

    return lines;
  }

  /**
   * Create a single line from words
   */
  private createLine(
    words: IWord[],
    x: number,
    y: number,
    blockIndex: number,
    alignment: 'left' | 'center' | 'right' | 'justify',
    maxWidth: number
  ): ITextLine {
    if (words.length === 0) {
      return {
        words: [],
        x,
        y,
        width: 0,
        height: 0,
        baseline: 0,
        ascent: 0,
        descent: 0,
        blockIndex,
        alignment,
      };
    }

    // Calculate line metrics
    let lineWidth = 0;
    let maxAscent = 0;
    let maxDescent = 0;
    let maxHeight = 0;

    words.forEach(word => {
      lineWidth += word.width;
      maxAscent = Math.max(maxAscent, word.ascent);
      maxDescent = Math.max(maxDescent, word.descent);
      maxHeight = Math.max(maxHeight, word.height);
    });

    // Apply alignment
    let alignmentOffset = 0;
    let wordSpacing = 0;

    switch (alignment) {
      case 'center':
        alignmentOffset = (maxWidth - lineWidth) / 2;
        break;
      case 'right':
        alignmentOffset = maxWidth - lineWidth;
        break;
      case 'justify':
        if (words.length > 1) {
          const totalWordWidth = words.reduce((sum, word) => sum + word.width, 0);
          const spaceToDistribute = maxWidth - totalWordWidth;
          wordSpacing = spaceToDistribute / (words.length - 1);
        }
        break;
    }

    return {
      words,
      x: x + alignmentOffset,
      y,
      width: lineWidth + (wordSpacing * (words.length - 1)),
      height: maxHeight,
      baseline: maxAscent,
      ascent: maxAscent,
      descent: maxDescent,
      blockIndex,
      alignment,
    };
  }

  /**
   * Create an empty line for empty blocks
   */
  private createEmptyBlockLine(block: ITextBlock, y: number, blockIndex: number): ITextLine[] {
    const defaultHeight = this.getBlockSpacing(block);
    
    return [{
      words: [],
      x: 0,
      y,
      width: 0,
      height: defaultHeight,
      baseline: defaultHeight * 0.8,
      ascent: defaultHeight * 0.8,
      descent: defaultHeight * 0.2,
      blockIndex,
      alignment: block.alignment || 'left',
    }];
  }

  /**
   * Calculate X position for a block (handles indentation)
   */
  private calculateBlockX(block: ITextBlock, listIndentation: number): number {
    let x = block.paddingLeft || 0;

    if (block.type === BlockType.ListItem) {
      x += (block.listLevel || 0) * listIndentation;
    }

    return x;
  }

  /**
   * Calculate spacing for different block types
   */
  private getBlockSpacing(block: ITextBlock): number {
    const defaultFontSize = this.config.defaultStyle.fontSize || 16;
    const lineHeight = this.config.defaultStyle.lineHeight || 1.2;
    
    switch (block.type) {
      case BlockType.Heading1:
        return defaultFontSize * 2 * lineHeight;
      case BlockType.Heading2:
        return defaultFontSize * 1.5 * lineHeight;
      case BlockType.Heading3:
        return defaultFontSize * 1.3 * lineHeight;
      case BlockType.Quote:
      case BlockType.Code:
        return defaultFontSize * 1.1 * lineHeight;
      default:
        return defaultFontSize * lineHeight;
    }
  }

  /**
   * Calculate width needed for list markers
   */
  private calculateListMarkerWidth(block: ITextBlock): number {
    if (block.type !== BlockType.ListItem) return 0;

    // Estimate marker width based on list type
    const defaultFontSize = this.config.defaultStyle.fontSize || 16;
    
    if (block.listType === ListType.Ordered) {
      // Assume up to 3 digits plus period and space
      return defaultFontSize * 2.5;
    } else {
      // Bullet point plus space
      return defaultFontSize * 1.2;
    }
  }

  /**
   * Calculate total dimensions of the layout
   */
  private calculateTotalDimensions(lines: ITextLine[]): { totalWidth: number; totalHeight: number } {
    if (lines.length === 0) {
      return { totalWidth: 0, totalHeight: 0 };
    }

    let maxWidth = 0;
    let totalHeight = 0;

    lines.forEach(line => {
      maxWidth = Math.max(maxWidth, line.x + line.width);
      totalHeight = Math.max(totalHeight, line.y + line.height);
    });

    return {
      totalWidth: maxWidth,
      totalHeight,
    };
  }

  /**
   * Get line at specific Y coordinate
   */
  getLineAtY(lines: ITextLine[], y: number): ITextLine | null {
    for (const line of lines) {
      if (y >= line.y && y <= line.y + line.height) {
        return line;
      }
    }
    return null;
  }

  /**
   * Get word at specific coordinates
   */
  getWordAtPosition(lines: ITextLine[], x: number, y: number): IWord | null {
    const line = this.getLineAtY(lines, y);
    if (!line) return null;

    let currentX = line.x;
    for (const word of line.words) {
      if (x >= currentX && x <= currentX + word.width) {
        return word;
      }
      currentX += word.width;
    }

    return null;
  }

  /**
   * Get character position from coordinates
   */
  getCharacterPositionFromCoordinates(layout: IRichTextLayout, x: number, y: number): {
    characterIndex: number;
    blockIndex: number;
    segmentIndex: number;
  } | null {
    const word = this.getWordAtPosition(layout.lines, x, y);
    if (!word) return null;

    const line = this.getLineAtY(layout.lines, y);
    if (!line) return null;

    // Calculate relative X within the word
    let wordStartX = line.x;
    for (const lineWord of line.words) {
      if (lineWord === word) break;
      wordStartX += lineWord.width;
    }

    const relativeX = x - wordStartX;
    const charIndex = this.metrics.getCharacterIndexFromX(word.text, relativeX, word.style);
    
    return {
      characterIndex: word.startIndex + charIndex,
      blockIndex: word.blockIndex,
      segmentIndex: word.segmentIndex,
    };
  }

  /**
   * Update layout configuration
   */
  updateConfig(newConfig: Partial<IRichTextConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}