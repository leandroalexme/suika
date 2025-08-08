import { escapeHtml, parseRGBAStr } from '@suika/common';
import { type IPoint } from '@suika/geo';

import { PaintType } from '../paint';
import { GraphicsType, type Optional } from '../type';
import {
  type GraphicsAttrs,
  type IAdvancedAttrs,
  type IGraphicsOpts,
  SuikaGraphics,
} from './graphics';
import { type IDrawInfo } from './type';
import { RichTextEngine } from '../text/rich_text_engine';
import { IRichTextConfig, IRichTextRenderContext, ITextStyle } from '../text/rich_text_types';

export interface RichTextAttrs extends GraphicsAttrs {
  content: string;
  fontSize: number;
  fontFamily: string;
  autoFit?: boolean;
  richText?: boolean; // Flag to enable rich text mode
  maxWidth?: number;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  lineHeight?: number;
}

const DEFAULT_TEXT_WIDTH = 200;
const DEFAULT_TEXT_HEIGHT = 40;

export class SuikaRichText extends SuikaGraphics<RichTextAttrs> {
  override type = GraphicsType.Text;
  
  private richTextEngine: RichTextEngine;
  private _isRichTextMode = false;

  constructor(
    attrs: Optional<Omit<RichTextAttrs, 'id'>, 'width' | 'height' | 'transform'>,
    opts: IGraphicsOpts,
  ) {
    super(
      {
        ...attrs,
        type: GraphicsType.Text,
        width: attrs.width ?? DEFAULT_TEXT_WIDTH,
        height: attrs.height ?? DEFAULT_TEXT_HEIGHT,
      },
      opts,
    );

    this._isRichTextMode = attrs.richText || false;
    
    // Initialize rich text engine
    const defaultStyle: ITextStyle = {
      fontFamily: attrs.fontFamily || 'sans-serif',
      fontSize: attrs.fontSize || 16,
      color: this.getTextColor(),
    };

    const config: IRichTextConfig = {
      defaultStyle,
      maxWidth: attrs.maxWidth || attrs.width,
      textAlign: attrs.textAlign || 'left',
      wordWrap: true,
      lineSpacing: attrs.lineHeight || 1.2,
      paragraphSpacing: 8,
      listIndentation: 20,
    };

    this.richTextEngine = new RichTextEngine(config);
    
    // Set initial content
    if (attrs.content) {
      if (this._isRichTextMode) {
        // Try to parse as HTML first, fallback to plain text
        if (attrs.content.includes('<') && attrs.content.includes('>')) {
          this.richTextEngine.setHTML(attrs.content);
        } else {
          this.richTextEngine.setText(attrs.content);
        }
      } else {
        this.richTextEngine.setText(attrs.content);
      }
    }

    // Auto-fit size if enabled
    if (attrs.autoFit) {
      this.autoFitSize();
    }
  }

  override updateAttrs(partialAttrs: Partial<RichTextAttrs> & IAdvancedAttrs) {
    const oldContent = this.attrs.content;
    
    super.updateAttrs(partialAttrs);

    // Update rich text mode
    if ('richText' in partialAttrs) {
      this._isRichTextMode = partialAttrs.richText || false;
    }

    // Update engine configuration
    let needsConfigUpdate = false;
    const configUpdates: Partial<IRichTextConfig> = {};

    if ('maxWidth' in partialAttrs || 'width' in partialAttrs) {
      configUpdates.maxWidth = partialAttrs.maxWidth || partialAttrs.width || this.attrs.width;
      needsConfigUpdate = true;
    }

    if ('textAlign' in partialAttrs) {
      configUpdates.textAlign = partialAttrs.textAlign;
      needsConfigUpdate = true;
    }

    if ('lineHeight' in partialAttrs) {
      configUpdates.lineSpacing = partialAttrs.lineHeight || 1.2;
      needsConfigUpdate = true;
    }

    if ('fontSize' in partialAttrs || 'fontFamily' in partialAttrs) {
      const defaultStyle: ITextStyle = {
        fontFamily: partialAttrs.fontFamily || this.attrs.fontFamily,
        fontSize: partialAttrs.fontSize || this.attrs.fontSize,
        color: this.getTextColor(),
      };
      configUpdates.defaultStyle = defaultStyle;
      needsConfigUpdate = true;
    }

    if (needsConfigUpdate) {
      this.richTextEngine.updateConfig(configUpdates);
    }

    // Update content if changed
    if ('content' in partialAttrs && partialAttrs.content !== oldContent) {
      const newContent = partialAttrs.content || '';
      
      if (this._isRichTextMode) {
        // Try to parse as HTML first, fallback to plain text
        if (newContent.includes('<') && newContent.includes('>')) {
          this.richTextEngine.setHTML(newContent);
        } else {
          this.richTextEngine.setText(newContent);
        }
      } else {
        this.richTextEngine.setText(newContent);
      }

      // Auto-fit if enabled
      if (this.attrs.autoFit) {
        this.autoFitSize();
      }
    }
  }

  override draw(drawInfo: IDrawInfo) {
    if (this.shouldSkipDraw(drawInfo)) return;

    const opacity = this.getOpacity() * (drawInfo.opacity ?? 1);
    const { transform } = this.attrs;
    const { ctx } = drawInfo;

    ctx.save();
    ctx.transform(...transform);
    
    if (opacity < 1) {
      ctx.globalAlpha = opacity;
    }

    // Use rich text engine for rendering
    const renderContext: IRichTextRenderContext = {
      ctx,
      x: 0,
      y: 0,
      width: this.attrs.width,
      height: this.attrs.height,
      scale: 1,
      opacity: opacity,
    };

    this.richTextEngine.render(renderContext);

    ctx.restore();
  }

  protected override getSVGTagHead(offset?: IPoint) {
    const tf = [...this.attrs.transform];
    tf[5] += this.attrs.fontSize;
    if (offset) {
      tf[4] += offset.x;
      tf[5] += offset.y;
    }
    return `<text x="0" y="0" transform="matrix(${tf.join(' ')})"`;
  }

  protected override getSVGTagTail(): string {
    // For SVG export, use HTML content if in rich text mode
    if (this._isRichTextMode) {
      const htmlContent = this.richTextEngine.exportToHTML();
      return `>${escapeHtml(htmlContent)}</text>`;
    } else {
      const content = escapeHtml(this.attrs.content);
      return `>${content}</text>`;
    }
  }

  override getLayerIconPath() {
    return 'M0 0H11V3H10V1H6V9H7.5V10H3.5V9H5V1H1V3H0V0Z';
  }

  /**
   * Get content length for cursor positioning
   */
  getContentLength() {
    return this.richTextEngine.getPlainText().length;
  }

  /**
   * Get cursor index from point coordinates
   */
  getCursorIndex(point: IPoint): number {
    const localPoint = this.getLocalPoint(point);
    const position = this.richTextEngine.getPositionFromCoordinates(localPoint.x, localPoint.y);
    return position?.characterIndex || 0;
  }

  /**
   * Provide glyph-like cursor anchors compatible with RangeManager expectations
   */
  getGlyphs() {
    // Build glyph-like per-character positions so RangeManager can map indices
    const layout = this.richTextEngine.getLayout();
    const glyphs: Array<{ position: IPoint; width: number; height: number }> = [];
    if (!layout) return glyphs;

    const tmpCanvas = document.createElement('canvas');
    const ctx = tmpCanvas.getContext('2d')!;

    layout.lines.forEach((line) => {
      let currentX = line.x;
      const topY = line.y;

      line.words.forEach((w) => {
        // Apply word style
        const fontFamily = w.style.fontFamily || 'sans-serif';
        const fontSize = w.style.fontSize || 16;
        const fontWeight = w.style.fontWeight || 'normal';
        const fontStyle = w.style.fontStyle || 'normal';
        ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;

        // Walk each character in the word to compute positions
        for (let i = 0; i < w.text.length; i++) {
          const char = w.text[i];
          const charWidth = ctx.measureText(char).width;
          glyphs.push({ position: { x: currentX, y: topY }, width: charWidth, height: w.height });
          currentX += charWidth;
        }
      });
    });

    return glyphs;
  }

  getContentMetrics() {
    const dims = this.richTextEngine.getDimensions();
    return {
      width: dims.width,
      height: dims.height,
      fontBoundingBoxAscent: this.attrs.fontSize, // fallback
      fontBoundingBoxDescent: 0,
    } as any;
  }

  /**
   * Get coordinates for cursor at given index
   */
  getCursorCoordinates(index: number): IPoint | null {
    const position = {
      characterIndex: index,
      blockIndex: 0,
      segmentIndex: 0,
    };
    
    const coords = this.richTextEngine.getCoordinatesFromPosition(position);
    if (!coords) return null;

    return this.getWorldPoint({ x: coords.x, y: coords.y });
  }

  /**
   * Set rich text content from HTML
   */
  setHTMLContent(html: string): void {
    this._isRichTextMode = true;
    this.richTextEngine.setHTML(html);
    this.updateAttrs({ content: html, richText: true });
    
    if (this.attrs.autoFit) {
      this.autoFitSize();
    }
  }

  /**
   * Set markdown content
   */
  setMarkdownContent(markdown: string): void {
    this._isRichTextMode = true;
    this.richTextEngine.setMarkdown(markdown);
    this.updateAttrs({ content: markdown, richText: true });
    
    if (this.attrs.autoFit) {
      this.autoFitSize();
    }
  }

  /**
   * Get HTML representation of content
   */
  getHTMLContent(): string {
    return this.richTextEngine.exportToHTML();
  }

  /**
   * Apply formatting to selected text
   */
  applyFormatting(style: Partial<ITextStyle>): void {
    this.richTextEngine.applyFormatting(style);
  }

  /**
   * Insert text at cursor position
   */
  insertTextAtCursor(text: string, style?: Partial<ITextStyle>): void {
    this.richTextEngine.insertText(text, style);
    
    // Update the content attribute
    const newContent = this._isRichTextMode 
      ? this.richTextEngine.exportToHTML() 
      : this.richTextEngine.getPlainText();
    
    this.updateAttrs({ content: newContent });
  }

  /**
   * Refresh attrs.content and size from current engine state
   */
  refreshFromEngine(): void {
    const newContent = this._isRichTextMode
      ? this.richTextEngine.exportToHTML()
      : this.richTextEngine.getPlainText();
    const dims = this.richTextEngine.getDimensions();
    this.updateAttrs({ content: newContent, width: dims.width, height: dims.height });
  }

  /**
   * Enable or disable rich text mode
   */
  setRichTextMode(enabled: boolean): void {
    if (this._isRichTextMode === enabled) return;
    
    this._isRichTextMode = enabled;
    
    // Re-parse content with new mode
    if (enabled) {
      this.richTextEngine.setHTML(this.attrs.content);
    } else {
      this.richTextEngine.setText(this.attrs.content);
    }
    
    this.updateAttrs({ richText: enabled });
  }

  /**
   * Check if rich text mode is enabled
   */
  isRichTextMode(): boolean {
    return this._isRichTextMode;
  }

  /**
   * Get text dimensions
   */
  getTextDimensions(): { width: number; height: number } {
    return this.richTextEngine.getDimensions();
  }

  /**
   * Auto-fit the text box to content
   */
  private autoFitSize(): void {
    const dimensions = this.richTextEngine.getDimensions();
    this.updateAttrs({
      width: Math.max(dimensions.width, 10),
      height: Math.max(dimensions.height, 10),
    });
  }

  /**
   * Get text color from fill paint
   */
  private getTextColor(): string {
    const fill = this.attrs.fill;
    if (!fill || fill.length === 0) return '#000000';
    
    const firstPaint = fill[0];
    if (firstPaint.type === PaintType.Solid) {
      return parseRGBAStr(firstPaint.attrs);
    }
    
    return '#000000';
  }

  /**
   * Convert world coordinates to local coordinates
   */
  private getLocalPoint(worldPoint: IPoint): IPoint {
    // Apply inverse transform to get local coordinates
    const matrix = this.getWorldTransform();
    const det = matrix[0] * matrix[3] - matrix[1] * matrix[2];
    
    if (Math.abs(det) < 1e-10) {
      return { x: 0, y: 0 };
    }
    
    const invDet = 1 / det;
    const x = worldPoint.x - matrix[4];
    const y = worldPoint.y - matrix[5];
    
    return {
      x: invDet * (matrix[3] * x - matrix[2] * y),
      y: invDet * (matrix[0] * y - matrix[1] * x),
    };
  }

  /**
   * Convert local coordinates to world coordinates
   */
  private getWorldPoint(localPoint: IPoint): IPoint {
    const matrix = this.getWorldTransform();
    
    return {
      x: matrix[0] * localPoint.x + matrix[2] * localPoint.y + matrix[4],
      y: matrix[1] * localPoint.x + matrix[3] * localPoint.y + matrix[5],
    };
  }

  protected override isFillShouldRender() {
    return true;
  }

  /**
   * Cleanup resources
   */
  destroy() {
    this.richTextEngine.destroy();
  }

  /**
   * Get rich text engine instance (for advanced usage)
   */
  getRichTextEngine(): RichTextEngine {
    return this.richTextEngine;
  }
}