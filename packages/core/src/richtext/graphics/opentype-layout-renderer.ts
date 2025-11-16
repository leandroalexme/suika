/**
 * OpenType Layout Renderer
 *
 * SCOPE:
 * - Multiple lines with automatic wrapping
 * - Multiple paragraphs
 * - Alignment (left, center, right, justify)
 * - Configurable line height
 * - Vector rendering with OpenType.js
 */

import { type RichTextModel } from '../types/models';
import { LayoutEngine, type LayoutResult } from './layout-engine';

// Constants for underline rendering
const UNDERLINE_POSITION_RATIO = 0.15; // Position below baseline (15% of font size)
const UNDERLINE_THICKNESS_RATIO = 0.06; // Thickness (6% of font size)
const MIN_UNDERLINE_THICKNESS = 1; // Minimum underline thickness in pixels

/**
 * Path2D cache to avoid recreating objects
 */
const path2DCache = new Map<string, Path2D>();

export class OpenTypeLayoutRenderer {
  private layoutEngine: LayoutEngine;
  private cachedModel: RichTextModel | null = null;
  private cachedLayout: LayoutResult | null = null;

  constructor() {
    this.layoutEngine = new LayoutEngine();
  }

  /**
   * Renders rich text with complete layout
   */
  render(ctx: CanvasRenderingContext2D, model: RichTextModel): void {
    const layout = this.getLayout(model);

    if (!layout || layout.lines.length === 0) {
      return;
    }

    ctx.save();

    // Renderizar todas as linhas
    for (const line of layout.lines) {
      for (const positionedRun of line.runs) {
        const fillColor =
          positionedRun.run.fill || model.defaultFill || '#000000';
        ctx.fillStyle = fillColor;

        // Render glyphs
        for (const glyph of positionedRun.glyphs) {
          if (glyph.pathData) {
            // Usar cache de Path2D
            let path2d = path2DCache.get(glyph.pathData);
            if (!path2d) {
              path2d = new Path2D(glyph.pathData);
              path2DCache.set(glyph.pathData, path2d);
            }

            ctx.save();
            ctx.translate(glyph.x, glyph.y);
            ctx.fill(path2d);
            ctx.restore();
          }
        }

        // Draw underline if needed
        if (
          positionedRun.run.textDecoration === 'underline' &&
          positionedRun.glyphs.length > 0
        ) {
          const firstGlyph = positionedRun.glyphs[0];
          const lastGlyph =
            positionedRun.glyphs[positionedRun.glyphs.length - 1];
          const fontSize =
            positionedRun.run.fontSize || model.defaultFontSize || 16;
          // OpenType.js uses baseline at top, so positive Y goes down
          // Add positive offset to place underline BELOW text
          const underlineY =
            line.y + line.height - fontSize * UNDERLINE_POSITION_RATIO;
          const underlineThickness = Math.max(
            MIN_UNDERLINE_THICKNESS,
            fontSize * UNDERLINE_THICKNESS_RATIO,
          );

          ctx.strokeStyle = fillColor;
          ctx.lineWidth = underlineThickness;
          ctx.beginPath();
          ctx.moveTo(firstGlyph.x, underlineY);
          ctx.lineTo(lastGlyph.x + lastGlyph.advance, underlineY);
          ctx.stroke();
        }
      }
    }

    ctx.restore();
  }

  /**
   * Calculates total text height
   */
  calculateHeight(model: RichTextModel): number {
    const layout = this.getLayout(model);
    return layout.height || 0;
  }

  /**
   * Calculates total text width
   */
  calculateWidth(model: RichTextModel): number {
    const layout = this.getLayout(model);
    return layout.width || 0;
  }

  /**
   * Gets selection rectangles for a text range (multi-line)
   * @param model - Rich text model
   * @param startOffset - Selection start offset
   * @param endOffset - Selection end offset
   * @returns Array of rectangles, one per line
   */
  getSelectionRects(
    model: RichTextModel,
    startOffset: number,
    endOffset: number,
  ): Array<{ x: number; y: number; width: number; height: number }> {
    const layout = this.getLayout(model);
    const rects: Array<{
      x: number;
      y: number;
      width: number;
      height: number;
    }> = [];

    let currentOffset = 0;

    for (let i = 0; i < layout.lines.length; i++) {
      const line = layout.lines[i];
      const lineStartOffset = currentOffset;

      // Calculate line's total character count
      let lineLength = 0;
      for (const positionedRun of line.runs) {
        lineLength += positionedRun.run.text?.length || 0;
      }

      const lineEndOffset = lineStartOffset + lineLength;

      // Check if this line intersects with selection
      if (lineEndOffset > startOffset && lineStartOffset < endOffset) {
        const selStart = Math.max(startOffset, lineStartOffset);
        const selEnd = Math.min(endOffset, lineEndOffset);

        // Get positions for start and end of selection in this line
        const startPos = this.getCaretPosition(model, selStart);
        const endPos = this.getCaretPosition(model, selEnd);

        if (startPos && endPos) {
          // If positions are on different lines (different y),
          // we need to find all intermediate lines
          if (Math.abs(startPos.y - endPos.y) > 5) {
            // Find all unique Y positions between selStart and selEnd
            const yPositions: Map<
              number,
              { minX: number; maxX: number; height: number }
            > = new Map();

            // Sample every character to find line breaks
            for (let offset = selStart; offset <= selEnd; offset++) {
              const pos = this.getCaretPosition(model, offset);
              if (pos) {
                const y = Math.round(pos.y); // Round to avoid floating point issues
                if (!yPositions.has(y)) {
                  yPositions.set(y, {
                    minX: pos.x,
                    maxX: pos.x,
                    height: pos.height,
                  });
                } else {
                  const existing = yPositions.get(y)!;
                  existing.minX = Math.min(existing.minX, pos.x);
                  existing.maxX = Math.max(existing.maxX, pos.x);
                }
              }
            }

            // Create rectangles for each line
            const sortedYs = Array.from(yPositions.keys()).sort(
              (a, b) => a - b,
            );
            for (let j = 0; j < sortedYs.length; j++) {
              const y = sortedYs[j];
              const lineInfo = yPositions.get(y)!;

              let rectX = lineInfo.minX;
              let rectWidth = lineInfo.maxX - lineInfo.minX;

              // First line: start from selection start
              if (j === 0) {
                rectX = startPos.x;
                rectWidth = (model.width || 300) - startPos.x;
              }
              // Last line: end at selection end
              else if (j === sortedYs.length - 1) {
                rectX = 0;
                rectWidth = endPos.x;
              }
              // Middle lines: full width
              else {
                rectX = 0;
                rectWidth = model.width || 300;
              }

              const rect = {
                x: rectX,
                y: y,
                width: rectWidth,
                height: lineInfo.height,
              };
              rects.push(rect);
            }
          } else {
            // Same line
            const rect = {
              x: startPos.x,
              y: startPos.y,
              width: endPos.x - startPos.x,
              height: startPos.height,
            };
            rects.push(rect);
          }
        }
      }

      // Advance currentOffset to next line
      currentOffset = lineEndOffset;

      if (currentOffset >= endOffset) {
        break;
      }
    }

    return rects;
  }

  /**
   * Gets layout (with caching)
   */
  private getLayout(model: RichTextModel): LayoutResult {
    // Check cache
    if (this.cachedModel === model && this.cachedLayout) {
      return this.cachedLayout;
    }

    // Calculate new layout
    const layout = this.layoutEngine.layout(model);

    // Update cache
    this.cachedModel = model;
    this.cachedLayout = layout;

    return layout;
  }

  /**
   * Invalidates layout cache
   */
  invalidateCache(): void {
    this.cachedModel = null;
    this.cachedLayout = null;
  }

  /**
   * Exports as SVG
   */
  toSVG(model: RichTextModel): string {
    const layout = this.getLayout(model);
    let svg = '';

    for (const line of layout.lines) {
      for (const positionedRun of line.runs) {
        const fillColor =
          positionedRun.run.fill || model.defaultFill || '#000000';

        for (const glyph of positionedRun.glyphs) {
          if (glyph.pathData) {
            // OpenType uses inverted Y, so we apply scale(1, -1)
            svg += `<path d="${glyph.pathData}" fill="${fillColor}" transform="translate(${glyph.x}, ${glyph.y}) scale(1, -1)"/>\n`;
          }
        }
      }
    }

    return svg;
  }

  /**
   * Hit Testing - Converts coordinates to text offset
   */
  hitTest(model: RichTextModel, x: number, y: number): number {
    const layout = this.getLayout(model);
    return this.layoutEngine.hitTest(layout, x, y);
  }

  /**
   * Returns caret position for a given offset
   */
  getCaretPosition(
    model: RichTextModel,
    offset: number,
  ): { x: number; y: number; height: number } | null {
    const layout = this.getLayout(model);
    return this.layoutEngine.getCaretPosition(layout, offset);
  }
}
