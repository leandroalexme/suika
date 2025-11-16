import {
  type GraphicsAttrs,
  type IGraphicsOpts,
  SuikaGraphics,
} from '../../graphics';
import { type IDrawInfo } from '../../graphics/type';
import { GraphicsType, type Optional } from '../../type';
import { type RichTextModel } from '../types/models';
import { OpenTypeLayoutRenderer } from './opentype-layout-renderer';

export interface RichTextAttrs extends GraphicsAttrs {
  model: RichTextModel;
}

// Constants for text editing behavior
const CARET_BLINK_INTERVAL_MS = 500;
const SELECTION_BACKGROUND_COLOR = 'rgba(0, 120, 215, 0.3)';
const CARET_COLOR = '#000000';
const CARET_WIDTH = 2;

export class SuikaRichText extends SuikaGraphics<RichTextAttrs> {
  override type = GraphicsType.RichText;
  private renderer: OpenTypeLayoutRenderer;
  private needsHeightUpdate = true;

  // Editing state
  private isEditing = false;
  private caretOffset = 0; // Current cursor position in text
  private selectionStart = 0; // Selection start offset
  private selectionEnd = 0; // Selection end offset
  private caretVisible = true; // For caret blink animation
  private caretBlinkInterval: number | null = null;
  private renderCallback: (() => void) | null = null;

  constructor(
    attrs: Optional<
      Omit<RichTextAttrs, 'id'>,
      'width' | 'height' | 'transform'
    >,
    opts: IGraphicsOpts,
  ) {
    // Ensure width and height are valid numbers
    const width = attrs.width ?? attrs.model.width ?? 300;
    const height = attrs.height ?? 100;

    super(
      {
        ...attrs,
        type: GraphicsType.RichText,
        width: isNaN(width) ? 300 : width,
        height: isNaN(height) ? 100 : height,
      },
      opts,
    );

    this.renderer = new OpenTypeLayoutRenderer();
    this.updateHeight();
  }

  override updateAttrs(partialAttrs: Partial<RichTextAttrs>) {
    // Verificar se precisa atualizar o modelo antes de chamar super
    const widthChanged =
      'width' in partialAttrs && partialAttrs.width !== undefined;
    const modelChanged = 'model' in partialAttrs;

    if (widthChanged || modelChanged) {
      this.needsHeightUpdate = true;
      this.renderer.invalidateCache();
    }

    super.updateAttrs(partialAttrs);

    // Se a largura mudou, sincronizar com o modelo
    if (widthChanged) {
      this.attrs.model = {
        ...this.attrs.model,
        width: this.attrs.width,
      };
    }

    // Não chamar updateHeight() aqui - será chamado no draw()
    // para garantir que o layout já foi recalculado
  }

  private updateHeight() {
    const height = this.renderer.calculateHeight(this.attrs.model);
    // Ensure height is a valid number
    this.attrs.height = isNaN(height) || height <= 0 ? 100 : height;
    this.needsHeightUpdate = false;
  }

  override draw(drawInfo: IDrawInfo) {
    if (this.shouldSkipDraw(drawInfo)) {
      return;
    }

    // Atualizar altura antes de desenhar, se necessário
    if (this.needsHeightUpdate) {
      this.updateHeight();
    }

    const { ctx } = drawInfo;

    ctx.save();
    ctx.transform(...this.attrs.transform);

    const opacity = this.getOpacity() * (drawInfo.opacity ?? 1);
    if (opacity < 1) {
      ctx.globalAlpha = opacity;
    }

    // Renderizar usando OpenType Layout (paths vetoriais com layout completo)
    this.renderer.render(ctx, this.attrs.model);

    // Fase 3: Renderizar seleção e caret se estiver editando
    if (this.isEditing) {
      this.drawSelection(ctx);
      this.drawCaret(ctx);
    }

    ctx.restore();
  }

  /**
   * Draws the selection background (supports multi-line selection)
   */
  private drawSelection(ctx: CanvasRenderingContext2D) {
    if (this.selectionStart === this.selectionEnd) {
      return; // No selection
    }

    const start = Math.min(this.selectionStart, this.selectionEnd);
    const end = Math.max(this.selectionStart, this.selectionEnd);

    ctx.fillStyle = SELECTION_BACKGROUND_COLOR;

    // Get selection rectangles (one per line)
    const rects = this.renderer.getSelectionRects(this.attrs.model, start, end);

    // Draw each rectangle
    for (const rect of rects) {
      ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
    }
  }

  /**
   * Draws the blinking caret (text cursor)
   */
  private drawCaret(ctx: CanvasRenderingContext2D) {
    if (!this.caretVisible) {
      return;
    }

    const caretPos = this.renderer.getCaretPosition(
      this.attrs.model,
      this.caretOffset,
    );

    if (caretPos) {
      ctx.strokeStyle = CARET_COLOR;
      ctx.lineWidth = CARET_WIDTH;
      ctx.beginPath();
      ctx.moveTo(caretPos.x, caretPos.y);
      ctx.lineTo(caretPos.x, caretPos.y + caretPos.height);
      ctx.stroke();
    }
  }

  override getSVGTagHead(): string {
    const tf = [...this.attrs.transform];
    return `<g transform="matrix(${tf.join(' ')})">`;
  }

  override getSVGTagTail(): string {
    // Exportar como paths vetoriais SVG
    const paths = this.renderer.toSVG(this.attrs.model);
    return `${paths}</g>\n`;
  }

  override getLayerIconPath() {
    return 'M0 0H11V3H10V1H6V9H7.5V10H3.5V9H5V1H1V3H0V0Z';
  }

  /**
   * Override para permitir hit testing no RichText
   * (RichText não usa fill/stroke, então precisa de lógica customizada)
   */
  override getHitGraphics(
    point: { x: number; y: number },
    options: { tol?: number },
  ): this | null {
    const { tol = 0 } = options;

    if (!this.isVisible() || this.isLock()) {
      return null;
    }

    if (this.hitTest(point, tol)) {
      return this;
    }

    return null;
  }

  override toJSON() {
    return {
      ...super.toJSON(),
      model: this.attrs.model,
    };
  }

  /**
   * Public editing methods
   */

  /**
   * Sets a callback to be called when render is needed (for caret blink)
   * @param callback - Function to call when render is needed
   */
  setRenderCallback(callback: (() => void) | null) {
    this.renderCallback = callback;
  }

  /**
   * Enters editing mode
   * @param clickX - Optional X coordinate to position caret
   * @param clickY - Optional Y coordinate to position caret
   */
  startEditing(clickX?: number, clickY?: number) {
    this.isEditing = true;

    // Position caret at click coordinates or end of text
    if (clickX !== undefined && clickY !== undefined) {
      this.caretOffset = this.renderer.hitTest(
        this.attrs.model,
        clickX,
        clickY,
      );
    } else {
      this.caretOffset = this.getTextLength();
    }

    this.selectionStart = this.caretOffset;
    this.selectionEnd = this.caretOffset;

    // Start caret blink animation
    this.startCaretBlink();
  }

  /**
   * Exits editing mode
   */
  stopEditing() {
    this.isEditing = false;
    this.stopCaretBlink();
  }

  /**
   * Checks if currently in editing mode
   * @returns True if editing is active
   */
  getIsEditing(): boolean {
    return this.isEditing;
  }

  /**
   * Starts the caret blink animation
   */
  private startCaretBlink() {
    this.stopCaretBlink();
    this.caretVisible = true;

    this.caretBlinkInterval = window.setInterval(() => {
      this.caretVisible = !this.caretVisible;
      // Force re-render by marking as updated
      this.doc.collectUpdatedGraphics(this.attrs.id);
      // Call render callback if set (from RichTextEditor)
      if (this.renderCallback) {
        this.renderCallback();
      }
    }, CARET_BLINK_INTERVAL_MS);
  }

  /**
   * Stops the caret blink animation
   */
  private stopCaretBlink() {
    if (this.caretBlinkInterval !== null) {
      clearInterval(this.caretBlinkInterval);
      this.caretBlinkInterval = null;
    }
  }

  /**
   * Returns the total text length across all paragraphs and runs
   */
  getTextLength(): number {
    let length = 0;
    for (const paragraph of this.attrs.model.paragraphs) {
      for (const run of paragraph.runs) {
        length += (run.text || '').length;
      }
    }
    return length;
  }

  /**
   * Inserts text at the current caret position
   * @param text - Text to insert
   */
  insertText(text: string) {
    // Find run and position within it
    const { paragraphIndex, runIndex, offsetInRun } =
      this.findPositionForOffset(this.caretOffset);

    if (paragraphIndex === -1) {
      return;
    }

    const paragraph = this.attrs.model.paragraphs[paragraphIndex];
    const run = paragraph.runs[runIndex];

    // Insert text into run
    const beforeText = (run.text || '').substring(0, offsetInRun);
    const afterText = (run.text || '').substring(offsetInRun);
    run.text = beforeText + text + afterText;

    // Update caret position
    this.caretOffset += text.length;
    this.selectionStart = this.caretOffset;
    this.selectionEnd = this.caretOffset;

    // Update model and force re-render
    this.updateAttrs({ model: this.attrs.model });
    this.caretVisible = true;
  }

  /**
   * Deletes character before caret (backspace)
   */
  deleteBackward() {
    if (this.caretOffset <= 0) {
      return;
    }

    // Find run and position within it
    const { paragraphIndex, runIndex, offsetInRun } =
      this.findPositionForOffset(this.caretOffset);

    if (paragraphIndex === -1 || offsetInRun === 0) {
      // At start of run, would need to merge with previous run
      // For now, just decrement offset
      this.caretOffset--;
      return;
    }

    const paragraph = this.attrs.model.paragraphs[paragraphIndex];
    const run = paragraph.runs[runIndex];

    // Delete character before offset
    const beforeText = (run.text || '').substring(0, offsetInRun - 1);
    const afterText = (run.text || '').substring(offsetInRun);
    run.text = beforeText + afterText;

    // Update caret position
    this.caretOffset--;
    this.selectionStart = this.caretOffset;
    this.selectionEnd = this.caretOffset;

    // Update model and force re-render
    this.updateAttrs({ model: this.attrs.model });
    this.caretVisible = true;
  }

  /**
   * Deletes character after caret (delete key)
   */
  deleteForward() {
    if (this.caretOffset >= this.getTextLength()) {
      return;
    }

    // Find run and position within it
    const { paragraphIndex, runIndex, offsetInRun } =
      this.findPositionForOffset(this.caretOffset);

    if (paragraphIndex === -1) {
      return;
    }

    const paragraph = this.attrs.model.paragraphs[paragraphIndex];
    const run = paragraph.runs[runIndex];

    // Delete character after offset
    const beforeText = (run.text || '').substring(0, offsetInRun);
    const afterText = (run.text || '').substring(offsetInRun + 1);
    run.text = beforeText + afterText;

    // Caret position doesn't change (deleted ahead)
    // But reset selection
    this.selectionStart = this.caretOffset;
    this.selectionEnd = this.caretOffset;

    // Update model and force re-render
    this.updateAttrs({ model: this.attrs.model });
    this.caretVisible = true;
  }

  /**
   * Finds the paragraph, run, and offset within run for a global offset
   */
  private findPositionForOffset(offset: number): {
    paragraphIndex: number;
    runIndex: number;
    offsetInRun: number;
  } {
    let currentOffset = 0;

    for (
      let pIndex = 0;
      pIndex < this.attrs.model.paragraphs.length;
      pIndex++
    ) {
      const paragraph = this.attrs.model.paragraphs[pIndex];

      for (let rIndex = 0; rIndex < paragraph.runs.length; rIndex++) {
        const run = paragraph.runs[rIndex];
        const runLength = (run.text || '').length;

        if (offset <= currentOffset + runLength) {
          return {
            paragraphIndex: pIndex,
            runIndex: rIndex,
            offsetInRun: offset - currentOffset,
          };
        }

        currentOffset += runLength;
      }
    }

    // If not found, return last run
    const lastParagraph =
      this.attrs.model.paragraphs[this.attrs.model.paragraphs.length - 1];
    return {
      paragraphIndex: this.attrs.model.paragraphs.length - 1,
      runIndex: lastParagraph.runs.length - 1,
      offsetInRun: (
        lastParagraph.runs[lastParagraph.runs.length - 1].text || ''
      ).length,
    };
  }

  /**
   * Moves the caret one position to the left
   */
  moveCaretLeft() {
    if (this.caretOffset > 0) {
      this.caretOffset--;
      this.selectionStart = this.caretOffset;
      this.selectionEnd = this.caretOffset;
      this.caretVisible = true;
      this.doc.collectUpdatedGraphics(this.attrs.id);
    }
  }

  /**
   * Moves the caret one position to the right
   */
  moveCaretRight() {
    if (this.caretOffset < this.getTextLength()) {
      this.caretOffset++;
      this.selectionStart = this.caretOffset;
      this.selectionEnd = this.caretOffset;
      this.caretVisible = true;
      this.doc.collectUpdatedGraphics(this.attrs.id);
    }
  }

  /**
   * Moves the caret to the start of the text
   */
  moveCaretToStart() {
    this.caretOffset = 0;
    this.selectionStart = 0;
    this.selectionEnd = 0;
    this.caretVisible = true;
    this.doc.collectUpdatedGraphics(this.attrs.id);
  }

  /**
   * Moves the caret to the end of the text
   */
  moveCaretToEnd() {
    this.caretOffset = this.getTextLength();
    this.selectionStart = this.caretOffset;
    this.selectionEnd = this.caretOffset;
    this.caretVisible = true;
    this.doc.collectUpdatedGraphics(this.attrs.id);
  }

  /**
   * Text selection methods
   */

  /**
   * Starts a text selection at the given coordinates
   * @param x - X coordinate in local space
   * @param y - Y coordinate in local space
   */
  startSelection(x: number, y: number) {
    const offset = this.renderer.hitTest(this.attrs.model, x, y);
    this.selectionStart = offset;
    this.selectionEnd = offset;
    this.caretOffset = offset;
  }

  /**
   * Updates the selection as the mouse moves
   * @param x - X coordinate in local space
   * @param y - Y coordinate in local space
   */
  updateSelection(x: number, y: number) {
    const offset = this.renderer.hitTest(this.attrs.model, x, y);
    this.selectionEnd = offset;
    this.caretOffset = offset;
    this.caretVisible = true;
    this.doc.collectUpdatedGraphics(this.attrs.id);
  }

  /**
   * Ends the text selection
   */
  endSelection() {
    // Selection is finalized, no action needed
    // Caret position is already set by updateSelection
  }

  /**
   * Returns the currently selected text
   */
  getSelectedText(): string {
    if (this.selectionStart === this.selectionEnd) {
      return '';
    }

    const start = Math.min(this.selectionStart, this.selectionEnd);
    const end = Math.max(this.selectionStart, this.selectionEnd);

    let currentOffset = 0;
    let selectedText = '';

    for (const paragraph of this.attrs.model.paragraphs) {
      for (const run of paragraph.runs) {
        const runText = run.text || '';
        const runLength = runText.length;

        // If this run contains part of the selection
        if (currentOffset + runLength > start && currentOffset < end) {
          const startInRun = Math.max(0, start - currentOffset);
          const endInRun = Math.min(runLength, end - currentOffset);
          selectedText += runText.substring(startInRun, endInRun);
        }

        currentOffset += runLength;

        if (currentOffset >= end) {
          return selectedText;
        }
      }
    }

    return selectedText;
  }

  /**
   * Deletes the selected text
   */
  deleteSelection() {
    if (this.selectionStart === this.selectionEnd) {
      return; // Nothing selected
    }

    const start = Math.min(this.selectionStart, this.selectionEnd);
    const end = Math.max(this.selectionStart, this.selectionEnd);

    // Find start and end positions
    const startPos = this.findPositionForOffset(start);
    const endPos = this.findPositionForOffset(end);

    // Simple case: selection within same run
    if (
      startPos.paragraphIndex === endPos.paragraphIndex &&
      startPos.runIndex === endPos.runIndex
    ) {
      const run =
        this.attrs.model.paragraphs[startPos.paragraphIndex].runs[
          startPos.runIndex
        ];
      const beforeText = (run.text || '').substring(0, startPos.offsetInRun);
      const afterText = (run.text || '').substring(endPos.offsetInRun);
      run.text = beforeText + afterText;
    } else {
      // Complex case: selection spans multiple runs/paragraphs
      // Optimized: reconstruct model instead of deleting character by character

      const newParagraphs: typeof this.attrs.model.paragraphs = [];

      // Keep paragraphs before selection
      for (let i = 0; i < startPos.paragraphIndex; i++) {
        newParagraphs.push(this.attrs.model.paragraphs[i]);
      }

      // Handle the paragraph(s) containing the selection
      const startPara = this.attrs.model.paragraphs[startPos.paragraphIndex];
      const endPara = this.attrs.model.paragraphs[endPos.paragraphIndex];

      // Create merged paragraph with text before start and after end
      const mergedParagraph = {
        ...startPara,
        runs: [] as typeof startPara.runs,
      };

      // Add runs before selection in start paragraph
      for (let i = 0; i < startPos.runIndex; i++) {
        mergedParagraph.runs.push(startPara.runs[i]);
      }

      // Add partial start run (text before selection)
      const startRun = startPara.runs[startPos.runIndex];
      if (startRun && startPos.offsetInRun > 0) {
        mergedParagraph.runs.push({
          ...startRun,
          text: (startRun.text || '').substring(0, startPos.offsetInRun),
        });
      }

      // Add partial end run (text after selection)
      const endRun = endPara.runs[endPos.runIndex];
      if (endRun && endPos.offsetInRun < (endRun.text || '').length) {
        const afterText = (endRun.text || '').substring(endPos.offsetInRun);
        if (
          mergedParagraph.runs.length > 0 &&
          mergedParagraph.runs[mergedParagraph.runs.length - 1].fontSize ===
            endRun.fontSize &&
          mergedParagraph.runs[mergedParagraph.runs.length - 1].fill ===
            endRun.fill
        ) {
          // Merge with previous run if same style
          mergedParagraph.runs[mergedParagraph.runs.length - 1].text +=
            afterText;
        } else {
          mergedParagraph.runs.push({
            ...endRun,
            text: afterText,
          });
        }
      }

      // Add remaining runs from end paragraph
      for (let i = endPos.runIndex + 1; i < endPara.runs.length; i++) {
        mergedParagraph.runs.push(endPara.runs[i]);
      }

      // Add merged paragraph if it has content
      if (mergedParagraph.runs.length > 0) {
        newParagraphs.push(mergedParagraph);
      } else {
        // Keep at least one empty run
        newParagraphs.push({
          ...mergedParagraph,
          runs: [
            {
              text: '',
              fontSize: startPara.runs[0]?.fontSize || 14,
              fill: startPara.runs[0]?.fill || '#000000',
            },
          ],
        });
      }

      // Keep paragraphs after selection
      for (
        let i = endPos.paragraphIndex + 1;
        i < this.attrs.model.paragraphs.length;
        i++
      ) {
        newParagraphs.push(this.attrs.model.paragraphs[i]);
      }

      this.attrs.model.paragraphs = newParagraphs;
    }

    // Position caret at start of selection
    this.caretOffset = start;
    this.selectionStart = start;
    this.selectionEnd = start;

    // Update model
    this.updateAttrs({ model: this.attrs.model });
    this.caretVisible = true;
  }

  /**
   * Selects all text
   */
  selectAll() {
    this.selectionStart = 0;
    this.selectionEnd = this.getTextLength();
    this.caretOffset = this.selectionEnd;
    this.caretVisible = true;
    this.doc.collectUpdatedGraphics(this.attrs.id);
  }

  /**
   * Checks if there is a text selection
   * @returns True if text is selected
   */
  hasSelection(): boolean {
    return this.selectionStart !== this.selectionEnd;
  }

  /**
   * FORMATTING METHODS
   * Apply formatting to the current selection
   */

  /**
   * Applies or toggles bold formatting to the selected text
   */
  applyBold() {
    if (!this.hasSelection()) {
      return;
    }

    const start = Math.min(this.selectionStart, this.selectionEnd);
    const end = Math.max(this.selectionStart, this.selectionEnd);
    const selectionIsBold = this.isSelectionBold(start, end);

    this.applyFormatting({
      fontWeight: selectionIsBold ? 400 : 700,
    });
  }

  /**
   * Applies or toggles italic formatting to the selected text
   */
  applyItalic() {
    if (!this.hasSelection()) {
      return;
    }

    const start = Math.min(this.selectionStart, this.selectionEnd);
    const end = Math.max(this.selectionStart, this.selectionEnd);
    const selectionIsItalic = this.isSelectionItalic(start, end);

    this.applyFormatting({
      fontStyle: selectionIsItalic ? 'normal' : 'italic',
    });
  }

  /**
   * Applies underline formatting to the selected text
   */
  applyUnderline() {
    if (!this.hasSelection()) {
      return;
    }
    const start = Math.min(this.selectionStart, this.selectionEnd);
    const end = Math.max(this.selectionStart, this.selectionEnd);
    const selectionIsUnderlined = this.isSelectionUnderlined(start, end);

    this.applyFormatting({
      textDecoration: selectionIsUnderlined ? 'none' : 'underline',
    });
  }

  /**
   * Applies a font size to the selected text
   * @param fontSize - Font size in pixels
   */
  applyFontSize(fontSize: number) {
    if (!this.hasSelection()) return;
    this.applyFormatting({ fontSize });
  }

  /**
   * Applies a color to the selected text
   * @param color - Color in hex format (e.g., '#ff0000')
   */
  applyColor(color: string) {
    if (!this.hasSelection()) return;
    this.applyFormatting({ fill: color });
  }

  /**
   * Applies a font family to the selected text
   * @param fontFamily - Font family name (e.g., 'Roboto', 'Arial')
   */
  applyFontFamily(fontFamily: string) {
    if (!this.hasSelection()) return;
    this.applyFormatting({ fontFamily });
  }

  /**
   * Generic method to apply formatting to the selected text
   * Splits runs as needed to apply formatting only to the selection
   * @param formatting - Partial TextRun properties to apply
   */
  private applyFormatting(
    formatting: Partial<{
      fontWeight?: string | number;
      fontStyle?: 'normal' | 'italic';
      textDecoration?: 'underline' | 'line-through' | 'none';
      fontSize?: number;
      fill?: string;
      fontFamily?: string;
    }>,
  ) {
    const start = Math.min(this.selectionStart, this.selectionEnd);
    const end = Math.max(this.selectionStart, this.selectionEnd);

    const { apply: formattingToApply, remove: formattingToRemove } =
      this.normalizeFormatting(formatting);

    if (start === end) {
      return; // No selection to format
    }

    let globalOffset = 0;

    const paragraphs = this.attrs.model.paragraphs;

    for (let pIdx = 0; pIdx < paragraphs.length; pIdx++) {
      const paragraph = paragraphs[pIdx];
      const originalRuns = paragraph.runs.slice();
      const newRuns: typeof paragraph.runs = [];

      for (let rIdx = 0; rIdx < originalRuns.length; rIdx++) {
        const run = originalRuns[rIdx];
        const runText = run.text || '';
        const runLength = runText.length;
        const runStartOffset = globalOffset;
        const runEndOffset = runStartOffset + runLength;

        if (runLength === 0) {
          newRuns.push({ ...run });
          globalOffset = runEndOffset;
          continue;
        }

        // Run is completely outside selection - keep as is
        if (runEndOffset <= start || runStartOffset >= end) {
          newRuns.push(run);
          globalOffset = runEndOffset;
          continue;
        }

        // Run intersects with selection - need to split
        const selStartInRun = Math.max(0, start - runStartOffset);
        const selEndInRun = Math.min(runLength, end - runStartOffset);

        // Before selection (if any)
        if (selStartInRun > 0) {
          newRuns.push({
            ...run,
            text: runText.substring(0, selStartInRun),
          });
        }

        // Selected portion (apply formatting)
        if (selEndInRun > selStartInRun) {
          const formattedRun = {
            ...run,
            ...formattingToApply,
            text: runText.substring(selStartInRun, selEndInRun),
          };

          for (const key of formattingToRemove) {
            delete (formattedRun as any)[key];
          }

          newRuns.push(formattedRun);
        }

        // After selection (if any)
        if (selEndInRun < runLength) {
          newRuns.push({
            ...run,
            text: runText.substring(selEndInRun),
          });
        }

        globalOffset = runEndOffset;
      }

      paragraph.runs = newRuns;
    }

    // Merge adjacent runs with identical formatting
    this.mergeAdjacentRuns();

    // Update model
    this.updateAttrs({ model: this.attrs.model });
    this.caretVisible = true;
  }

  /**
   * Iterates over all runs that intersect with the current selection
   */
  private forEachSelectedRunSegment(
    start: number,
    end: number,
    callback: (params: {
      paragraphIndex: number;
      runIndex: number;
      run: RichTextModel['paragraphs'][number]['runs'][number];
    }) => void,
  ) {
    if (start >= end) {
      return;
    }

    let globalOffset = 0;

    for (let pIdx = 0; pIdx < this.attrs.model.paragraphs.length; pIdx++) {
      const paragraph = this.attrs.model.paragraphs[pIdx];
      for (let rIdx = 0; rIdx < paragraph.runs.length; rIdx++) {
        const run = paragraph.runs[rIdx];
        const runText = run.text || '';
        const runLength = runText.length;
        const runStartOffset = globalOffset;
        const runEndOffset = runStartOffset + runLength;

        if (runLength > 0 && runEndOffset > start && runStartOffset < end) {
          callback({
            paragraphIndex: pIdx,
            runIndex: rIdx,
            run,
          });
        }

        globalOffset = runEndOffset;
      }
    }
  }

  /**
   * Normalizes formatting values before applying
   */
  private normalizeFormatting(
    formatting: Partial<{
      fontWeight?: string | number;
      fontStyle?: 'normal' | 'italic';
      textDecoration?: 'underline' | 'line-through' | 'none';
      fontSize?: number;
      fill?: string;
      fontFamily?: string;
    }>,
  ): {
    apply: Partial<{
      fontWeight?: number;
      fontStyle?: 'italic';
      textDecoration?: 'underline';
      fontSize?: number;
      fill?: string;
      fontFamily?: string;
    }>;
    remove: Array<'fontWeight' | 'fontStyle' | 'textDecoration'>;
  } {
    const apply: Partial<{
      fontWeight?: number;
      fontStyle?: 'italic';
      textDecoration?: 'underline';
      fontSize?: number;
      fill?: string;
      fontFamily?: string;
    }> = {};
    const remove: Array<'fontWeight' | 'fontStyle' | 'textDecoration'> = [];

    if (formatting.fontWeight !== undefined) {
      const numericWeight = this.normalizeFontWeightValue(
        formatting.fontWeight,
      );
      if (numericWeight === 400) {
        remove.push('fontWeight');
      } else {
        apply.fontWeight = numericWeight;
      }
    }

    if (formatting.fontStyle !== undefined) {
      if (formatting.fontStyle === 'italic') {
        apply.fontStyle = 'italic';
      } else {
        remove.push('fontStyle');
      }
    }

    if (formatting.textDecoration !== undefined) {
      if (formatting.textDecoration === 'underline') {
        apply.textDecoration = 'underline';
      } else {
        remove.push('textDecoration');
      }
    }

    if (formatting.fontSize !== undefined) {
      apply.fontSize = formatting.fontSize;
    }

    if (formatting.fill !== undefined) {
      apply.fill = formatting.fill;
    }

    if (formatting.fontFamily !== undefined) {
      apply.fontFamily = formatting.fontFamily;
    }

    return { apply, remove };
  }

  private normalizeFontWeightValue(weight: string | number): number {
    if (typeof weight === 'number') {
      return weight;
    }

    const weightLower = weight.toLowerCase();
    const keywordMap: Record<string, number> = {
      thin: 100,
      hairline: 100,
      'extra-light': 200,
      'ultra-light': 200,
      light: 300,
      normal: 400,
      regular: 400,
      medium: 500,
      'semi-bold': 600,
      'demi-bold': 600,
      bold: 700,
      'extra-bold': 800,
      'ultra-bold': 800,
      black: 900,
      heavy: 900,
    };

    if (keywordMap[weightLower] !== undefined) {
      return keywordMap[weightLower];
    }

    const numeric = parseInt(weight, 10);
    if (!Number.isNaN(numeric)) {
      return numeric;
    }

    // Unable to normalize, use default
    return 400;
  }

  private isSelectionBold(start: number, end: number): boolean {
    let hasSegment = false;
    let allBold = true;

    this.forEachSelectedRunSegment(start, end, ({ run }) => {
      hasSegment = true;
      const weight = this.normalizeFontWeightValue(run.fontWeight ?? 400);
      if (weight < 600) {
        allBold = false;
      }
    });

    return hasSegment && allBold;
  }

  private isSelectionItalic(start: number, end: number): boolean {
    let hasSegment = false;
    let allItalic = true;

    this.forEachSelectedRunSegment(start, end, ({ run }) => {
      hasSegment = true;
      const fontStyle = run.fontStyle ?? 'normal';
      if (fontStyle !== 'italic') {
        allItalic = false;
      }
    });

    return hasSegment && allItalic;
  }

  private isSelectionUnderlined(start: number, end: number): boolean {
    let hasSegment = false;
    let allUnderlined = true;

    this.forEachSelectedRunSegment(start, end, ({ run }) => {
      hasSegment = true;
      const decoration = run.textDecoration ?? 'none';
      if (decoration !== 'underline') {
        allUnderlined = false;
      }
    });

    return hasSegment && allUnderlined;
  }

  /**
   * Merges adjacent runs with identical formatting to simplify the model
   */
  private mergeAdjacentRuns() {
    for (const paragraph of this.attrs.model.paragraphs) {
      const mergedRuns: typeof paragraph.runs = [];

      for (const run of paragraph.runs) {
        const lastRun = mergedRuns[mergedRuns.length - 1];

        // Check if we can merge with the previous run
        if (
          lastRun &&
          lastRun.fontFamily === run.fontFamily &&
          lastRun.fontSize === run.fontSize &&
          lastRun.fontWeight === run.fontWeight &&
          lastRun.fontStyle === run.fontStyle &&
          lastRun.fill === run.fill &&
          lastRun.textDecoration === run.textDecoration
        ) {
          // Merge: append text to last run
          lastRun.text = (lastRun.text || '') + (run.text || '');
        } else {
          // Cannot merge: add as new run
          mergedRuns.push(run);
        }
      }

      paragraph.runs = mergedRuns;
    }
  }

  /**
   * Selects the word at the given coordinates (double-click behavior)
   * @param x - X coordinate in local space
   * @param y - Y coordinate in local space
   */
  selectWordAt(x: number, y: number) {
    const offset = this.renderer.hitTest(this.attrs.model, x, y);
    const text = this.getFullText();

    // Find word boundaries
    let start = offset;
    let end = offset;

    // Word boundary regex: alphanumeric and some punctuation
    const isWordChar = (char: string) =>
      /[\w\u00C0-\u024F\u1E00-\u1EFF]/.test(char);

    // Expand left to start of word
    while (start > 0 && isWordChar(text[start - 1])) {
      start--;
    }

    // Expand right to end of word
    while (end < text.length && isWordChar(text[end])) {
      end++;
    }

    // If no word found (clicked on space/punctuation), select that character
    if (start === end && end < text.length) {
      end++;
    }

    this.selectionStart = start;
    this.selectionEnd = end;
    this.caretOffset = end;
    this.caretVisible = true;
    this.doc.collectUpdatedGraphics(this.attrs.id);
  }

  /**
   * Selects the entire line/paragraph at the given coordinates
   * @param x - X coordinate in local space
   * @param y - Y coordinate in local space
   */
  selectLineAt(x: number, y: number) {
    const offset = this.renderer.hitTest(this.attrs.model, x, y);
    const text = this.getFullText();

    // Find start of line (search backwards for \n or start of text)
    let start = offset;
    while (start > 0 && text[start - 1] !== '\n') {
      start--;
    }

    // Find end of line (search forwards for \n or end of text)
    let end = offset;
    while (end < text.length && text[end] !== '\n') {
      end++;
    }

    this.selectionStart = start;
    this.selectionEnd = end;
    this.caretOffset = end;
    this.caretVisible = true;
    this.doc.collectUpdatedGraphics(this.attrs.id);
  }

  /**
   * Gets the full text content (all paragraphs and runs concatenated)
   * @returns Full text as a single string
   */
  private getFullText(): string {
    let text = '';
    for (let i = 0; i < this.attrs.model.paragraphs.length; i++) {
      const paragraph = this.attrs.model.paragraphs[i];
      for (const run of paragraph.runs) {
        text += run.text || '';
      }
      // Add newline between paragraphs (but not after the last one)
      if (i < this.attrs.model.paragraphs.length - 1) {
        text += '\n';
      }
    }
    return text;
  }
}
