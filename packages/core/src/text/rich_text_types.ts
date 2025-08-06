/**
 * Rich Text Implementation for Suika Editor
 * Based on Miro's approach: https://medium.com/miro-engineering/how-we-learned-to-draw-text-on-html5-canvas-9f5613e64f5
 */

/**
 * Text styling properties
 */
export interface ITextStyle {
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: 'normal' | 'bold' | number;
  fontStyle?: 'normal' | 'italic';
  textDecoration?: 'none' | 'underline' | 'line-through';
  color?: string;
  backgroundColor?: string;
  letterSpacing?: number;
  lineHeight?: number;
}

/**
 * Block types supported
 */
export enum BlockType {
  Paragraph = 'paragraph',
  Heading1 = 'h1',
  Heading2 = 'h2',
  Heading3 = 'h3',
  ListItem = 'list-item',
  Quote = 'quote',
  Code = 'code'
}

/**
 * List types
 */
export enum ListType {
  Unordered = 'unordered',
  Ordered = 'ordered'
}

/**
 * A text segment with unified styling
 */
export interface ITextSegment {
  text: string;
  style: ITextStyle;
  startIndex: number; // Starting character index in the original content
  endIndex: number; // Ending character index in the original content
}

/**
 * A text block (paragraph, heading, list item)
 */
export interface ITextBlock {
  type: BlockType;
  segments: ITextSegment[];
  listType?: ListType;
  listLevel?: number;
  alignment?: 'left' | 'center' | 'right' | 'justify';
  marginTop?: number;
  marginBottom?: number;
  paddingLeft?: number;
  paddingRight?: number;
  startIndex: number;
  endIndex: number;
}

/**
 * A single word with its metrics and styling
 */
export interface IWord {
  text: string;
  style: ITextStyle;
  width: number;
  height: number;
  ascent: number;
  descent: number;
  startIndex: number;
  endIndex: number;
  segmentIndex: number; // Reference to the segment this word belongs to
  blockIndex: number; // Reference to the block this word belongs to
}

/**
 * A line of text with positioned words
 */
export interface ITextLine {
  words: IWord[];
  x: number;
  y: number;
  width: number;
  height: number;
  baseline: number;
  ascent: number;
  descent: number;
  blockIndex: number;
  alignment: 'left' | 'center' | 'right' | 'justify';
}

/**
 * Complete layout result ready for rendering
 */
export interface IRichTextLayout {
  lines: ITextLine[];
  totalWidth: number;
  totalHeight: number;
  blocks: ITextBlock[];
  words: IWord[];
}

/**
 * Word metrics calculation result
 */
export interface IWordMetrics {
  width: number;
  height: number;
  ascent: number;
  descent: number;
}

/**
 * Configuration for the rich text engine
 */
export interface IRichTextConfig {
  defaultStyle: ITextStyle;
  maxWidth?: number;
  maxHeight?: number;
  lineSpacing?: number;
  paragraphSpacing?: number;
  listIndentation?: number;
  wordWrap?: boolean;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
}

/**
 * Position in the rich text content
 */
export interface IRichTextPosition {
  characterIndex: number;
  blockIndex: number;
  segmentIndex: number;
  wordIndex?: number;
  lineIndex?: number;
}

/**
 * Selection range in rich text
 */
export interface IRichTextSelection {
  start: IRichTextPosition;
  end: IRichTextPosition;
  collapsed: boolean;
}

/**
 * Cursor information
 */
export interface IRichTextCursor {
  position: IRichTextPosition;
  x: number;
  y: number;
  height: number;
  visible: boolean;
}

/**
 * Rich text content representation
 */
export interface IRichTextContent {
  blocks: ITextBlock[];
  totalCharacterCount: number;
  plainText: string; // Cached plain text version
}

/**
 * Events emitted by the rich text engine
 */
export interface IRichTextEvents {
  'content-changed': (content: IRichTextContent) => void;
  'selection-changed': (selection: IRichTextSelection) => void;
  'cursor-changed': (cursor: IRichTextCursor) => void;
  'layout-changed': (layout: IRichTextLayout) => void;
}

/**
 * Rich text rendering context
 */
export interface IRichTextRenderContext {
  ctx: CanvasRenderingContext2D;
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
  opacity?: number;
}