import { escapeHtml, parseRGBAStr } from '@suika/common';
import {
  applyInverseMatrix,
  calcGlyphInfos,
  calcTextSize,
  type IGlyph,
  type IPoint,
  type ITextMetrics,
} from '@suika/geo';

import { PaintType } from '../paint';
import { RichTextEngine } from '../text/rich_text_engine';
import type {
  IRichTextConfig,
  IRichTextRenderContext,
  ITextStyle,
} from '../text/rich_text_types';
import { GraphicsType, type Optional } from '../type';
import {
  type GraphicsAttrs,
  type IAdvancedAttrs,
  type IGraphicsOpts,
  SuikaGraphics,
} from './graphics';
import { type IDrawInfo } from './type';

export interface TextAttrs extends GraphicsAttrs {
  content: string;
  fontSize: number;
  fontFamily: string;
  autoFit?: boolean;
  richText?: boolean; // Flag to enable rich text mode
  maxWidth?: number;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  lineHeight?: number;
}

const DEFAULT_TEXT_WIDTH = 80;
const DEFAULT_TEXT_WEIGHT = 30;

const tmpCtx = document.createElement('canvas').getContext('2d')!;

export class SuikaText extends SuikaGraphics<TextAttrs> {
  override type = GraphicsType.Text;

  private _glyphs: IGlyph[] | null = null;
  private contentMetrics: ITextMetrics | null = null;
  private richTextEngine: RichTextEngine | null = null;
  private _isRichTextMode = false;

  constructor(
    attrs: Optional<Omit<TextAttrs, 'id'>, 'width' | 'height' | 'transform'>,
    opts: IGraphicsOpts,
  ) {
    super(
      {
        ...attrs,
        type: GraphicsType.Text,
        width: attrs.width ?? DEFAULT_TEXT_WIDTH,
        height: attrs.height ?? DEFAULT_TEXT_WEIGHT,
      },
      opts,
    );

    this._isRichTextMode = attrs.richText || false;

    // Initialize rich text engine if needed
    if (this._isRichTextMode) {
      this.initRichTextEngine(attrs);
    }

    if (attrs.autoFit) {
      if (this._isRichTextMode && this.richTextEngine) {
        this.autoFitRichText();
      } else {
        tmpCtx.font = `${attrs.fontSize}px ${attrs.fontFamily}`;
        const { width } = tmpCtx.measureText(attrs.content);
        this.attrs.width = width;
        this.attrs.height = attrs.fontSize;
      }
    }
  }

  override updateAttrs(partialAttrs: Partial<TextAttrs> & IAdvancedAttrs) {
    const isContentChanged =
      'content' in partialAttrs && partialAttrs.content !== this.attrs.content;
    const isFontChanged =
      'fontSize' in partialAttrs || 'fontFamily' in partialAttrs;
    const isFontFamilyChanged =
      'fontFamily' in partialAttrs &&
      partialAttrs.fontFamily !== this.attrs.fontFamily;

    // Handle rich text mode changes
    if ('richText' in partialAttrs) {
      this._isRichTextMode = partialAttrs.richText || false;
      if (this._isRichTextMode && !this.richTextEngine) {
        this.initRichTextEngine(this.attrs);
      }
    }

    // Update rich text engine if needed
    if (this._isRichTextMode && this.richTextEngine) {
      if (isContentChanged || isFontChanged || isFontFamilyChanged) {
        this.updateRichTextEngine(partialAttrs);
      }
    } else {
      if (isContentChanged || isFontChanged || isFontFamilyChanged) {
        this._glyphs = null;
      }
    }
    
    super.updateAttrs(partialAttrs);
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

    if (this._isRichTextMode && this.richTextEngine) {
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
    } else {
      // Use original rendering
      const { fill, stroke, fontSize, content, fontFamily } = this.attrs;
      
      ctx.beginPath();
      ctx.font = `${fontSize}px ${fontFamily ?? 'sans-serif'}`;

      for (const paint of fill ?? []) {
        switch (paint.type) {
          case PaintType.Solid: {
            ctx.fillStyle = parseRGBAStr(paint.attrs);
            break;
          }
          case PaintType.Image: {
            // TODO:
          }
        }
      }
      if (stroke) {
        // TODO:
      }

      ctx.fontKerning = 'none'; // no kerning
      ctx.translate(0, this.getContentMetrics().fontBoundingBoxAscent);
      ctx.fillText(content, 0, 0);
    }
    
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
    const content = escapeHtml(this.attrs.content);
    return `>${content}</text>`;
  }

  override getLayerIconPath() {
    return 'M0 0H11V3H10V1H6V9H7.5V10H3.5V9H5V1H1V3H0V0Z';
  }

  getGlyphs() {
    if (this._glyphs) return this._glyphs;
    this._glyphs = calcGlyphInfos(this.attrs.content, {
      fontSize: this.attrs.fontSize,
      fontFamily: this.attrs.fontFamily,
    });
    return this._glyphs;
  }

  getContentMetrics() {
    if (this.contentMetrics) return this.contentMetrics;
    this.contentMetrics = calcTextSize(this.attrs.content, {
      fontSize: this.attrs.fontSize,
      fontFamily: this.attrs.fontFamily,
    });
    return this.contentMetrics;
  }

  getContentLength() {
    return this.getGlyphs().length - 1;
  }

  protected override isFillShouldRender() {
    // TODO: optimize
    return true;
  }

  getCursorIndex(point: IPoint) {
    if (this._isRichTextMode && this.richTextEngine) {
      const localPoint = applyInverseMatrix(this.getWorldTransform(), point);
      const position = this.richTextEngine.getPositionFromCoordinates(localPoint.x, localPoint.y);
      return position?.characterIndex || 0;
    }

    point = applyInverseMatrix(this.getWorldTransform(), point);
    const glyphs = this.getGlyphs();

    // binary search, find the nearest but not greater than point.x glyph index
    let left = 0;
    let right = glyphs.length - 1;
    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const glyph = glyphs[mid];
      if (point.x < glyph.position.x) {
        right = mid - 1;
      } else {
        left = mid + 1;
      }
    }
    if (left === 0) return 0;
    if (left >= glyphs.length) return glyphs.length - 1;

    if (
      glyphs[left].position.x - point.x >
      point.x - glyphs[right].position.x
    ) {
      return right;
    }
    return left;
  }

  // Rich text specific methods
  private initRichTextEngine(attrs: Partial<TextAttrs>) {
    const defaultStyle: ITextStyle = {
      fontFamily: attrs.fontFamily || 'sans-serif',
      fontSize: attrs.fontSize || 16,
      color: this.getTextColor(),
    };

    const config: IRichTextConfig = {
      defaultStyle,
      maxWidth: attrs.maxWidth || attrs.width || DEFAULT_TEXT_WIDTH,
      textAlign: attrs.textAlign || 'left',
      wordWrap: true,
      lineSpacing: attrs.lineHeight || 1.2,
      paragraphSpacing: 8,
      listIndentation: 20,
    };

    this.richTextEngine = new RichTextEngine(config);
    
    if (attrs.content) {
      if (attrs.content.includes('<') && attrs.content.includes('>')) {
        this.richTextEngine.setHTML(attrs.content);
      } else {
        this.richTextEngine.setText(attrs.content);
      }
    }
  }

  private updateRichTextEngine(partialAttrs: Partial<TextAttrs>) {
    if (!this.richTextEngine) return;

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

    if ('content' in partialAttrs) {
      const newContent = partialAttrs.content || '';
      if (newContent.includes('<') && newContent.includes('>')) {
        this.richTextEngine.setHTML(newContent);
      } else {
        this.richTextEngine.setText(newContent);
      }
    }
  }

  private autoFitRichText() {
    if (!this.richTextEngine) return;
    
    const dimensions = this.richTextEngine.getDimensions();
    this.updateAttrs({
      width: Math.max(dimensions.width, 10),
      height: Math.max(dimensions.height, 10),
    });
  }

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
   * Set rich text content from HTML
   */
  setHTMLContent(html: string): void {
    this._isRichTextMode = true;
    if (!this.richTextEngine) {
      this.initRichTextEngine(this.attrs);
    }
    this.richTextEngine!.setHTML(html);
    this.updateAttrs({ content: html, richText: true });
  }

  /**
   * Enable or disable rich text mode
   */
  setRichTextMode(enabled: boolean): void {
    if (this._isRichTextMode === enabled) return;
    
    this._isRichTextMode = enabled;
    
    if (enabled && !this.richTextEngine) {
      this.initRichTextEngine(this.attrs);
    }
    
    this.updateAttrs({ richText: enabled });
  }

  /**
   * Check if rich text mode is enabled
   */
  isRichTextMode(): boolean {
    return this._isRichTextMode;
  }
}
