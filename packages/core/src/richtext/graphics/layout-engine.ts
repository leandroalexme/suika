/**
 * Layout Engine
 *
 * Responsible for:
 * - Line breaking (word wrap)
 * - Multi-line layout
 * - Alignment (left, center, right, justify)
 * - Line height
 * - Multiple paragraphs
 */

import type * as opentype from 'opentype.js';

import { fontManager } from '../font/font_manager';
import {
  type Paragraph,
  type RichTextModel,
  type TextRun,
} from '../types/models';

/**
 * Global glyph cache to avoid recalculating paths
 * TODO: Consider implementing LRU cache with size limit for long-running applications
 */
const glyphCache = new Map<string, { pathData: string; advance: number }>();

function getGlyphCacheKey(
  char: string,
  fontFamily: string,
  fontSize: number,
): string {
  return `${char}_${fontFamily}_${fontSize}`;
}

/**
 * Information about a positioned glyph
 */
export interface PositionedGlyph {
  pathData: string;
  x: number;
  y: number;
  advance: number;
  char: string;
}

/**
 * A positioned text run within a line
 */
export interface PositionedRun {
  run: TextRun;
  glyphs: PositionedGlyph[];
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * A laid-out line of text
 */
export interface LayoutLine {
  runs: PositionedRun[];
  x: number;
  y: number;
  width: number;
  height: number;
  baseline: number;
}

/**
 * Complete layout result
 */
export interface LayoutResult {
  lines: LayoutLine[];
  width: number;
  height: number;
}

/**
 * Layout engine for rich text
 */
export class LayoutEngine {
  /**
   * Calculates the complete layout for the model
   * @param model - Rich text model to layout
   * @returns Layout result with positioned lines and dimensions
   */
  layout(model: RichTextModel): LayoutResult {
    const lines: LayoutLine[] = [];
    const maxWidth = model.width || Infinity;
    let currentY = 0;

    // Process each paragraph
    for (const paragraph of model.paragraphs) {
      const paragraphLines = this.layoutParagraph(
        paragraph,
        model,
        maxWidth,
        currentY,
      );

      lines.push(...paragraphLines);

      // Update Y for next paragraph
      if (paragraphLines.length > 0) {
        const lastLine = paragraphLines[paragraphLines.length - 1];
        currentY = lastLine.y + lastLine.height;
      }
    }

    // Calculate total dimensions
    const totalWidth = Math.max(
      ...lines.map((l) => l.width),
      model.minWidth || 0,
    );
    const totalHeight = currentY;

    return {
      lines,
      width: totalWidth,
      height: totalHeight,
    };
  }

  /**
   * Layouts a paragraph (may generate multiple lines)
   */
  private layoutParagraph(
    paragraph: Paragraph,
    model: RichTextModel,
    maxWidth: number,
    startY: number,
  ): LayoutLine[] {
    const lines: LayoutLine[] = [];
    const runs = paragraph.runs;
    const lineHeight = paragraph.lineHeight || 1.3;
    const textAlign = paragraph.textAlign || 'left';

    // Measure all runs and break into words
    const words = this.breakIntoWords(runs, model);

    // Group words into lines
    const lineGroups = this.breakIntoLines(words, maxWidth);

    // Position each line
    let currentY = startY;
    for (let i = 0; i < lineGroups.length; i++) {
      const lineWords = lineGroups[i];

      const line = this.positionLine(
        lineWords,
        textAlign,
        maxWidth,
        currentY,
        lineHeight,
        model,
      );

      lines.push(line);
      currentY += line.height;
    }

    return lines;
  }

  /**
   * Breaks runs into individual words
   */
  private breakIntoWords(
    runs: TextRun[],
    model: RichTextModel,
  ): Array<{
    run: TextRun;
    text: string;
    glyphs: PositionedGlyph[];
    width: number;
  }> {
    const words: Array<{
      run: TextRun;
      text: string;
      glyphs: PositionedGlyph[];
      width: number;
    }> = [];

    for (const run of runs) {
      const text = run.text || '';
      const fontSize = run.fontSize || model.defaultFontSize || 16;
      const fontFamily = run.fontFamily || model.defaultFontFamily || 'Arial';
      const fontWeight = run.fontWeight || 400;
      const fontStyle = run.fontStyle || 'normal';

      // Get font with variant (bold, italic, etc)
      const font = fontManager.getFontWithVariant(
        fontFamily,
        fontWeight,
        fontStyle,
      );
      if (!font) {
        // Font not loaded, skip this run
        continue;
      }

      // Break into words (by spaces)
      const wordTexts = text.split(/(\s+)/); // Keep spaces

      for (const wordText of wordTexts) {
        if (wordText.length === 0) continue;

        const glyphs = this.measureText(wordText, font, fontSize, fontFamily);
        const width = glyphs.reduce((sum, g) => sum + g.advance, 0);

        words.push({
          run,
          text: wordText,
          glyphs,
          width,
        });
      }
    }

    return words;
  }

  /**
   * Measures text and returns glyphs with metrics (with caching)
   */
  private measureText(
    text: string,
    font: opentype.Font,
    fontSize: number,
    fontFamily: string = 'Roboto',
  ): PositionedGlyph[] {
    const glyphs: PositionedGlyph[] = [];
    const scale = fontSize / font.unitsPerEm;
    let currentX = 0;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];

      try {
        const glyph = font.charToGlyph(char);
        if (!glyph) continue;

        // Tentar obter do cache
        const cacheKey = getGlyphCacheKey(char, fontFamily, fontSize);
        let cachedGlyph = glyphCache.get(cacheKey);

        if (!cachedGlyph) {
          // Cache miss - calcular e armazenar
          const glyphPath = glyph.getPath(0, 0, fontSize);
          const pathData = glyphPath.toPathData(2);
          const advance = (glyph.advanceWidth || 0) * scale;

          cachedGlyph = { pathData, advance };
          glyphCache.set(cacheKey, cachedGlyph);
        }

        glyphs.push({
          pathData: cachedGlyph.pathData,
          x: currentX,
          y: 0,
          advance: cachedGlyph.advance,
          char,
        });

        currentX += cachedGlyph.advance;

        // Kerning
        if (i < text.length - 1 && font.kerningPairs) {
          try {
            const nextGlyph = font.charToGlyph(text[i + 1]);
            if (nextGlyph && font.getKerningValue) {
              const kerning = font.getKerningValue(glyph, nextGlyph) * scale;
              if (kerning) {
                currentX += kerning;
              }
            }
          } catch (err) {
            // Ignorar erros de kerning
          }
        }
      } catch (error) {
        // Silenciar erros individuais
      }
    }

    return glyphs;
  }

  /**
   * Normalizes word glyphs to start at X=0
   */
  private normalizeWordGlyphs(word: {
    run: TextRun;
    text: string;
    glyphs: PositionedGlyph[];
    width: number;
  }): {
    run: TextRun;
    text: string;
    glyphs: PositionedGlyph[];
    width: number;
  } {
    if (word.glyphs.length === 0) return word;

    // Get first X position
    const firstX = word.glyphs[0].x;

    // If already normalized (first X is 0), return as is
    if (firstX === 0) return word;

    // Normalize all glyphs
    const normalizedGlyphs = word.glyphs.map((g) => ({
      ...g,
      x: g.x - firstX,
    }));

    return {
      ...word,
      glyphs: normalizedGlyphs,
    };
  }

  /**
   * Breaks words into lines respecting maxWidth
   * With support for word breaking (breaks by character when word doesn't fit)
   */
  private breakIntoLines(
    words: Array<{
      run: TextRun;
      text: string;
      glyphs: PositionedGlyph[];
      width: number;
    }>,
    maxWidth: number,
  ): Array<
    Array<{
      run: TextRun;
      text: string;
      glyphs: PositionedGlyph[];
      width: number;
    }>
  > {
    const lines: Array<
      Array<{
        run: TextRun;
        text: string;
        glyphs: PositionedGlyph[];
        width: number;
      }>
    > = [];
    let currentLine: Array<{
      run: TextRun;
      text: string;
      glyphs: PositionedGlyph[];
      width: number;
    }> = [];
    let currentWidth = 0;

    for (const word of words) {
      // If word contains \n, force line break
      if (word.text.includes('\n')) {
        if (currentLine.length > 0) {
          lines.push(currentLine);
        }
        lines.push([]); // Empty line for \n
        currentLine = [];
        currentWidth = 0;
        continue;
      }

      // If adding this word exceeds maxWidth, break line
      if (currentWidth + word.width > maxWidth && currentLine.length > 0) {
        lines.push(currentLine);
        currentLine = [];
        currentWidth = 0;
      }

      // WORD BREAKING: If word alone doesn't fit in line, break by character
      if (word.width > maxWidth && !word.text.match(/^\s+$/)) {
        // Word too long, needs character breaking
        const brokenWords = this.breakWordByCharacter(
          word,
          maxWidth,
          currentWidth,
        );

        for (let i = 0; i < brokenWords.length; i++) {
          const brokenWord = brokenWords[i];

          // First part: add to current line if there's space
          if (
            i === 0 &&
            currentWidth > 0 &&
            currentWidth + brokenWord.width <= maxWidth
          ) {
            currentLine.push(this.normalizeWordGlyphs(brokenWord));
            currentWidth += brokenWord.width;
          } else {
            // If current line has content, finalize it
            if (currentLine.length > 0) {
              lines.push(currentLine);
              currentLine = [];
              currentWidth = 0;
            }

            // Add broken part to new line
            currentLine.push(this.normalizeWordGlyphs(brokenWord));
            currentWidth = brokenWord.width;
          }
        }
      } else {
        // Word fits normally
        // If it's start of new line and word is only whitespace, skip
        if (currentLine.length === 0 && word.text.match(/^\s+$/)) {
          continue;
        }
        // Normalize glyphs before adding
        currentLine.push(this.normalizeWordGlyphs(word));
        currentWidth += word.width;
      }
    }

    // Add last line
    if (currentLine.length > 0) {
      lines.push(currentLine);
    }

    return lines;
  }

  /**
   * Breaks a word by character when it doesn't fit in the line
   * Returns array of smaller "words" that fit within max width
   */
  private breakWordByCharacter(
    word: {
      run: TextRun;
      text: string;
      glyphs: PositionedGlyph[];
      width: number;
    },
    maxWidth: number,
    currentLineWidth: number,
  ): Array<{
    run: TextRun;
    text: string;
    glyphs: PositionedGlyph[];
    width: number;
  }> {
    const result: Array<{
      run: TextRun;
      text: string;
      glyphs: PositionedGlyph[];
      width: number;
    }> = [];

    let currentGlyphs: PositionedGlyph[] = [];
    let currentText = '';
    let currentWidth = 0;
    let glyphX = 0;

    // Available width on first line (if there's text before)
    const firstLineAvailable =
      currentLineWidth > 0 ? maxWidth - currentLineWidth : maxWidth;

    for (let i = 0; i < word.glyphs.length; i++) {
      const glyph = word.glyphs[i];
      const isFirstPart = result.length === 0;
      const availableWidth = isFirstPart ? firstLineAvailable : maxWidth;

      // If adding this glyph exceeds available width
      if (
        currentWidth + glyph.advance > availableWidth &&
        currentGlyphs.length > 0
      ) {
        // Create word part
        result.push({
          run: word.run,
          text: currentText,
          glyphs: currentGlyphs,
          width: currentWidth,
        });

        // Reset for next part
        currentGlyphs = [];
        currentText = '';
        currentWidth = 0;
        glyphX = 0;
      }

      // Add glyph to current part
      currentGlyphs.push({
        ...glyph,
        x: glyphX, // Reposition X relative to start of this part
      });
      currentText += glyph.char;
      currentWidth += glyph.advance;
      glyphX += glyph.advance;
    }

    // Add last part
    if (currentGlyphs.length > 0) {
      result.push({
        run: word.run,
        text: currentText,
        glyphs: currentGlyphs,
        width: currentWidth,
      });
    }

    return result;
  }

  /**
   * Positions a line with alignment
   */
  private positionLine(
    words: Array<{
      run: TextRun;
      text: string;
      glyphs: PositionedGlyph[];
      width: number;
    }>,
    textAlign: 'left' | 'center' | 'right' | 'justify',
    maxWidth: number,
    y: number,
    lineHeight: number,
    model: RichTextModel,
  ): LayoutLine {
    const runs: PositionedRun[] = [];

    // Calculate total line width
    const totalWidth = words.reduce((sum, w) => sum + w.width, 0);

    // Calculate X offset based on alignment
    let startX = 0;
    if (textAlign === 'center') {
      startX = (maxWidth - totalWidth) / 2;
    } else if (textAlign === 'right') {
      startX = maxWidth - totalWidth;
    }

    // Calculate line height (largest fontSize)
    const maxFontSize = Math.max(
      ...words.map((w) => w.run.fontSize || model.defaultFontSize || 16),
    );
    const lineHeightPx = maxFontSize * lineHeight;
    const baseline = maxFontSize; // Baseline = fontSize

    // Position each word
    let currentX = startX;

    for (let i = 0; i < words.length; i++) {
      const word = words[i];

      // Calculate absolute position of each glyph in the word
      const wordGlyphs: PositionedGlyph[] = [];

      for (const glyph of word.glyphs) {
        const glyphY = y + baseline;
        const absoluteX = currentX + glyph.x; // glyph.x is relative to word start

        wordGlyphs.push({
          ...glyph,
          x: absoluteX,
          y: glyphY,
        });
      }

      // Create a run for this word
      runs.push({
        run: word.run,
        glyphs: wordGlyphs,
        x: currentX,
        y: y + baseline,
        width: word.width,
        height: word.run.fontSize || model.defaultFontSize || 16,
      });

      currentX += word.width;
    }

    return {
      runs,
      x: startX,
      y,
      width: totalWidth,
      height: lineHeightPx,
      baseline,
    };
  }

  /**
   * Converts coordinates (x, y) to text offset (Hit Testing)
   * Returns the index of the character closest to the clicked point
   */
  hitTest(layout: LayoutResult, x: number, y: number): number {
    // If no lines, return 0
    if (layout.lines.length === 0) {
      return 0;
    }

    // Find closest line
    let closestLine = layout.lines[0];
    let minDistance = Math.abs(y - (closestLine.y + closestLine.height / 2));

    for (const line of layout.lines) {
      const lineCenter = line.y + line.height / 2;
      const distance = Math.abs(y - lineCenter);
      if (distance < minDistance) {
        minDistance = distance;
        closestLine = line;
      }
    }

    // Calculate offset to start of this line
    let offset = 0;
    for (const line of layout.lines) {
      if (line === closestLine) break;
      // Count characters in all runs of this line
      for (const run of line.runs) {
        offset += run.glyphs.length;
      }
    }

    // Within the line, find closest glyph
    for (const run of closestLine.runs) {
      for (let i = 0; i < run.glyphs.length; i++) {
        const glyph = run.glyphs[i];
        const glyphCenter = glyph.x + glyph.advance / 2;

        // If click is before center of this glyph, return current offset
        if (x < glyphCenter) {
          return offset;
        }

        offset++;
      }
    }

    // If we got here, click is after last character
    return offset;
  }

  /**
   * Returns the (x, y) position for a given text offset
   * Useful for positioning the caret
   */
  getCaretPosition(
    layout: LayoutResult,
    offset: number,
  ): { x: number; y: number; height: number } | null {
    if (layout.lines.length === 0) {
      return { x: 0, y: 0, height: 16 };
    }

    let currentOffset = 0;

    // Percorrer linhas e runs para encontrar o offset
    for (const line of layout.lines) {
      let lineLength = 0;

      // Calcular tamanho total da linha
      for (const run of line.runs) {
        if (run && run.glyphs) {
          lineLength += run.glyphs.length;
        }
      }

      // Se o offset está nesta linha
      if (offset <= currentOffset + lineLength) {
        // Percorrer runs para encontrar posição exata
        for (const run of line.runs) {
          if (!run || !run.glyphs || run.glyphs.length === 0) {
            continue;
          }

          if (offset <= currentOffset + run.glyphs.length) {
            const glyphIndex = offset - currentOffset;

            // Se está no início do run
            if (glyphIndex === 0) {
              return {
                x: run.x || 0,
                y: line.y,
                height: line.height || 16,
              };
            }

            // Se está no meio ou fim do run
            const glyph = run.glyphs[glyphIndex - 1];
            if (glyph) {
              return {
                x: glyph.x + glyph.advance,
                y: line.y,
                height: line.height || 16,
              };
            }
          }
          currentOffset += run.glyphs.length;
        }
      }

      currentOffset += lineLength;
    }

    // Se o offset está além do texto, retornar posição no final da última linha
    const lastLine = layout.lines[layout.lines.length - 1];
    if (!lastLine || !lastLine.runs || lastLine.runs.length === 0) {
      return { x: 0, y: 0, height: 16 };
    }

    const lastRun = lastLine.runs[lastLine.runs.length - 1];
    if (!lastRun || !lastRun.glyphs || lastRun.glyphs.length === 0) {
      return { x: 0, y: lastLine.y || 0, height: lastLine.height || 16 };
    }

    const lastGlyph = lastRun.glyphs[lastRun.glyphs.length - 1];

    return {
      x: lastGlyph.x + lastGlyph.advance,
      y: lastLine.y,
      height: lastLine.height,
    };
  }
}
