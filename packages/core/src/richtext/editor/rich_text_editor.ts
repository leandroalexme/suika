/**
 * Rich Text Editor - Native Input Implementation
 *
 * High-performance rich text editor using an invisible HTML input element
 * to leverage native browser text input capabilities, including IME support.
 *
 * Architecture:
 * - Invisible input DOM captures native keyboard events
 * - Mouse events handle text selection and caret positioning
 * - Renders vector text using OpenType.js on Canvas 2D
 *
 * @see {@link SuikaRichText} for the graphics element
 * @see {@link OpenTypeLayoutRenderer} for rendering implementation
 */

import { type IPoint } from '@suika/geo';

import { type SuikaEditor } from '../../editor';
import { type IMouseEvent } from '../../host_event_manager';
import { type SuikaRichText } from '../graphics/rich-text';

// Constants for editor behavior
const MAX_INPUT_LENGTH = 10000; // Maximum text length
const MAX_PASTE_LENGTH = 10000; // Maximum paste length
const MULTI_CLICK_THRESHOLD_MS = 300; // Time threshold for multi-click detection (ms)
const FOCUS_RETRY_DELAY_MS = 10; // Delay for focus retry (ms)

/**
 * Styles for the invisible input element
 * Positioned off-screen but maintains focus for keyboard input
 */
const defaultInputStyle = {
  position: 'absolute',
  top: '0px',
  left: '0px',
  width: '1px',
  height: '1px',
  zIndex: '99999',
  margin: 0,
  padding: 0,
  border: 0,
  outline: 0,
  opacity: 0.01, // Almost invisible but allows focus
  pointerEvents: 'none',
} as const;

/**
 * Rich text editor with native input performance
 *
 * Uses an invisible HTML input element to capture keyboard input,
 * providing native typing speed and IME support while rendering
 * vector text on canvas.
 */
export class RichTextEditor {
  /** Invisible input element for capturing keyboard events */
  private inputDom: HTMLInputElement;

  /** Currently active rich text graphics element */
  private richTextGraphics: SuikaRichText | null = null;

  /** Whether the editor is currently active */
  private _active = false;

  /** Whether the user is currently dragging to select text */
  private isDragging = false;

  /** Timestamp of last click for multi-click detection */
  private lastClickTime = 0;

  /** Click count for multi-click detection (1=single, 2=double, 3=triple) */
  private clickCount = 0;

  /**
   * Creates a new rich text editor instance
   * @param editor - The parent Suika editor instance
   */
  constructor(private editor: SuikaEditor) {
    this.inputDom = this.createInputDom();
    this.inactive();
    this.bindEvents();
    editor.containerElement.appendChild(this.inputDom);
  }

  /**
   * Creates the invisible input DOM element
   * @returns Configured input element
   */
  private createInputDom(): HTMLInputElement {
    const inputDom = document.createElement('input');
    inputDom.type = 'text';
    inputDom.setAttribute('autocomplete', 'off');
    inputDom.setAttribute('autocorrect', 'off');
    inputDom.setAttribute('autocapitalize', 'off');
    inputDom.setAttribute('spellcheck', 'false');
    Object.assign(inputDom.style, defaultInputStyle);
    return inputDom;
  }

  /**
   * Checks if the editor is currently active
   * @returns True if editor is in editing mode
   */
  isActive(): boolean {
    return this._active;
  }

  /**
   * Gets the currently active rich text graphics element
   * @returns The active rich text element, or null if inactive
   */
  getRichTextGraphics(): SuikaRichText | null {
    return this.richTextGraphics;
  }

  /**
   * Activates the editor for a rich text element
   *
   * Disables transform controls, enters editing mode, and focuses
   * the invisible input to capture keyboard events.
   *
   * @param richText - The rich text element to edit
   * @param clickPos - Optional click position to place the caret
   */
  active(richText: SuikaRichText, clickPos?: IPoint): void {
    const wasActive = this._active && this.richTextGraphics === richText;

    // If already active on same element, just reposition caret
    if (wasActive && clickPos) {
      const localPos = this.worldToLocal(richText, clickPos);
      richText.startEditing(localPos.x, localPos.y);
      this.inputDom.focus();
      this.editor.render();
      return;
    }

    this._active = true;
    this.richTextGraphics = richText;

    // Set render callback for caret blink animation
    richText.setRenderCallback(() => this.editor.render());

    // Disable transform controls during editing
    this.editor.controlHandleManager.enableTransformControl = false;
    this.editor.selectedBox.enableDrawSizeIndicator = false;

    // Enter editing mode
    if (clickPos) {
      const localPos = this.worldToLocal(richText, clickPos);
      richText.startEditing(localPos.x, localPos.y);
    } else {
      richText.startEditing();
    }

    // Focus invisible input to capture keyboard events
    // Use requestAnimationFrame to ensure focus happens after render
    requestAnimationFrame(() => {
      this.inputDom.focus();
    });
    this.editor.render();
  }

  /**
   * Deactivates the editor and exits editing mode
   *
   * Re-enables transform controls and stops editing the current
   * rich text element.
   */
  inactive(): void {
    if (!this._active) return;

    this._active = false;

    if (this.richTextGraphics) {
      this.richTextGraphics.stopEditing();
      // Clear render callback
      this.richTextGraphics.setRenderCallback(null);
      this.richTextGraphics = null;
    }

    // Re-enable transform controls
    this.editor.controlHandleManager.enableTransformControl = true;
    this.editor.selectedBox.enableDrawSizeIndicator = true;

    // Remove focus from input
    this.inputDom.blur();
  }

  /**
   * Converts world coordinates to local coordinates relative to rich text
   * @param richText - The rich text element
   * @param worldPos - Position in world coordinates
   * @returns Position in local coordinates
   */
  private worldToLocal(richText: SuikaRichText, worldPos: IPoint): IPoint {
    const transform = richText.getWorldTransform();
    return {
      x: worldPos.x - transform[4],
      y: worldPos.y - transform[5],
    };
  }

  /**
   * Checks if a point is inside the rich text bounds
   * @param point - Point to test in world coordinates
   * @returns True if point is inside the rich text
   */
  private isClickInside(point: IPoint): boolean {
    if (!this.richTextGraphics) return false;
    return this.richTextGraphics.hitTest(point, 0);
  }

  /**
   * Binds all event listeners for the editor
   *
   * Sets up:
   * - Input event for native text insertion (with IME support)
   * - Keydown for navigation and commands
   * - Mouse events for selection and caret positioning
   */
  private bindEvents(): void {
    const inputDom = this.inputDom;

    // INPUT EVENT - Native performance with IME support
    inputDom.addEventListener('input', (e: Event) => {
      const inputEvent = e as InputEvent;
      const richText = this.richTextGraphics;
      if (!richText || !this._active) return;

      // Only process when not composing (IME) and has data
      if (!inputEvent.isComposing && inputEvent.data) {
        let textToInsert = inputEvent.data;

        // Limit input length to prevent performance issues
        const currentLength = richText.getTextLength();

        if (currentLength + textToInsert.length > MAX_INPUT_LENGTH) {
          const remaining = MAX_INPUT_LENGTH - currentLength;
          if (remaining <= 0) {
            inputDom.value = '';
            return;
          }
          textToInsert = textToInsert.substring(0, remaining);
        }

        // Delete selection if exists
        if (richText.hasSelection()) {
          richText.deleteSelection();
        }

        // Insert text
        richText.insertText(textToInsert);

        // Clear input to prevent accumulation
        inputDom.value = '';

        this.editor.render();
      }
    });

    // KEYDOWN - Navigation and special commands only
    inputDom.addEventListener('keydown', (e: KeyboardEvent) => {
      if (!this._active || !this.richTextGraphics) return;

      const richText = this.richTextGraphics;

      // Arrow key navigation
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        richText.moveCaretLeft();
        this.editor.render();
        return;
      }

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        richText.moveCaretRight();
        this.editor.render();
        return;
      }

      if (e.key === 'Home') {
        e.preventDefault();
        richText.moveCaretToStart();
        this.editor.render();
        return;
      }

      if (e.key === 'End') {
        e.preventDefault();
        richText.moveCaretToEnd();
        this.editor.render();
        return;
      }

      // Backspace - delete before caret
      if (e.key === 'Backspace') {
        e.preventDefault();
        if (richText.hasSelection()) {
          richText.deleteSelection();
        } else {
          richText.deleteBackward();
        }
        // Clear input to prevent input event from inserting text
        this.inputDom.value = '';
        this.editor.render();
        return;
      }

      // Delete - delete after caret
      if (e.key === 'Delete') {
        e.preventDefault();
        if (richText.hasSelection()) {
          richText.deleteSelection();
        } else {
          richText.deleteForward();
        }
        // Clear input to prevent input event from inserting text
        this.inputDom.value = '';
        this.editor.render();
        return;
      }

      // Select all (Ctrl+A / Cmd+A)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        richText.selectAll();
        this.editor.render();
        return;
      }

      // Copy (Ctrl+C / Cmd+C)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        const selectedText = richText.getSelectedText();
        if (selectedText) {
          navigator.clipboard.writeText(selectedText).catch(() => {
            // Fallback: use execCommand if clipboard API fails
            const textarea = document.createElement('textarea');
            textarea.value = selectedText;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
          });
        }
        return;
      }

      // Cut (Ctrl+X / Cmd+X)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'x') {
        e.preventDefault();
        const selectedText = richText.getSelectedText();
        if (selectedText) {
          navigator.clipboard.writeText(selectedText).catch(() => {
            // Fallback: use execCommand
            const textarea = document.createElement('textarea');
            textarea.value = selectedText;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
          });
          richText.deleteSelection();
          this.editor.render();
        }
        return;
      }

      // Paste (Ctrl+V / Cmd+V)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        navigator.clipboard
          .readText()
          .then((text) => {
            if (text) {
              // Limit paste to prevent performance issues
              if (text.length > MAX_PASTE_LENGTH) {
                text = text.substring(0, MAX_PASTE_LENGTH);
              }

              if (richText.hasSelection()) {
                richText.deleteSelection();
              }
              richText.insertText(text);
              this.editor.render();
            }
          })
          .catch(() => {
            // Clipboard API not available, paste will be handled by input event
          });
        return;
      }

      // Enter - insert line break
      if (e.key === 'Enter') {
        e.preventDefault();
        if (richText.hasSelection()) {
          richText.deleteSelection();
        }
        richText.insertText('\n');
        this.editor.render();
        return;
      }

      // Exit editing mode (Escape)
      if (e.key === 'Escape') {
        e.preventDefault();
        this.inactive();
        return;
      }
    });

    // MOUSE EVENTS - Selection and caret positioning
    const onMouseDown = (e: IMouseEvent) => {
      if (!this._active || !this.richTextGraphics) return;

      // Only handle left mouse button (button 0)
      // Ignore middle button (pan) and right button (context menu)
      if (e.nativeEvent.button !== 0) {
        return;
      }

      const point = e.pos;

      // Exit editing mode if clicked outside
      if (!this.isClickInside(point)) {
        this.inactive();
        return;
      }

      // Prevent event from bubbling to tool_select (which would move the text box)
      e.nativeEvent.stopPropagation();

      const now = Date.now();
      const timeSinceLastClick = now - this.lastClickTime;

      // Detect multi-click (double/triple click)
      if (timeSinceLastClick < MULTI_CLICK_THRESHOLD_MS) {
        this.clickCount++;
      } else {
        this.clickCount = 1;
      }
      this.lastClickTime = now;

      const localPos = this.worldToLocal(this.richTextGraphics, point);

      if (this.clickCount === 1) {
        // Single click: position caret and start potential drag selection
        this.richTextGraphics.startSelection(localPos.x, localPos.y);
        this.isDragging = true;
      } else if (this.clickCount === 2) {
        // Double click: select word
        this.richTextGraphics.selectWordAt(localPos.x, localPos.y);
        this.isDragging = false; // Don't allow drag after double-click
        this.editor.render();
      } else if (this.clickCount >= 3) {
        // Triple click: select line/paragraph
        this.richTextGraphics.selectLineAt(localPos.x, localPos.y);
        this.isDragging = false; // Don't allow drag after triple-click
        this.clickCount = 0; // Reset for next cycle
        this.editor.render();
      }

      // Keep focus on invisible input
      requestAnimationFrame(() => {
        this.inputDom.focus();

        // Second attempt after a short delay to ensure focus
        setTimeout(() => {
          if (document.activeElement !== this.inputDom) {
            this.inputDom.focus();
          }
        }, FOCUS_RETRY_DELAY_MS);
      });
    };

    const onMouseMove = (e: IMouseEvent) => {
      if (!this._active || !this.richTextGraphics || !this.isDragging) return;

      // Prevent event from bubbling to tool_select
      e.nativeEvent.stopPropagation();

      const point = e.pos;
      const localPos = this.worldToLocal(this.richTextGraphics, point);
      this.richTextGraphics.updateSelection(localPos.x, localPos.y);
      this.editor.render();
    };

    const onMouseUp = (e: IMouseEvent) => {
      if (!this._active || !this.richTextGraphics) return;

      if (this.isDragging) {
        // Prevent event from bubbling to tool_select
        e.nativeEvent.stopPropagation();

        this.richTextGraphics.endSelection();
        this.isDragging = false;
        this.editor.render();
      }
    };

    this.editor.mouseEventManager.on('start', onMouseDown);
    this.editor.mouseEventManager.on('drag', onMouseMove);
    this.editor.mouseEventManager.on('end', onMouseUp);
  }

  /**
   * Destroys the editor and cleans up resources
   *
   * Deactivates the editor and removes the input DOM element
   * from the container.
   */
  destroy(): void {
    this.inactive();
    if (this.inputDom.parentElement) {
      this.inputDom.parentElement.removeChild(this.inputDom);
    }
  }
}
