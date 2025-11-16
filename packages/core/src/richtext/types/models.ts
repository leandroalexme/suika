export interface TextRun {
  text: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string | number;
  fontStyle?: 'normal' | 'italic';
  fill?: string;
  textDecoration?: 'underline' | 'line-through' | 'none';
  letterSpacing?: number;
}

export interface Paragraph {
  runs: TextRun[];
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  lineHeight?: number;
}

export interface RichTextModel {
  paragraphs: Paragraph[];
  width?: number;
  minWidth?: number;
  defaultFontFamily?: string;
  defaultFontSize?: number;
  defaultFill?: string;
}
