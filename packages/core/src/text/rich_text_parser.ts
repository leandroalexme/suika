import type {
  ITextBlock,
  ITextSegment,
  ITextStyle,
  BlockType,
  ListType,
  IRichTextContent,
} from './rich_text_types';

/**
 * HTML-like markup parser for rich text
 * Supports basic HTML tags: <p>, <h1>-<h3>, <ul>, <ol>, <li>, <b>, <i>, <u>, <em>, <strong>
 */
export class RichTextParser {
  private defaultStyle: ITextStyle;

  constructor(defaultStyle: ITextStyle) {
    this.defaultStyle = defaultStyle;
  }

  /**
   * Parse HTML-like markup into rich text content
   */
  parseHTML(html: string): IRichTextContent {
    // Clean and normalize HTML
    const cleanHtml = this.cleanHTML(html);
    
    // Parse into blocks
    const blocks = this.parseBlocks(cleanHtml);
    
    // Calculate total character count and plain text
    let totalCharacterCount = 0;
    let plainText = '';
    
    blocks.forEach(block => {
      block.segments.forEach(segment => {
        totalCharacterCount += segment.text.length;
        plainText += segment.text;
      });
      // Add newline after each block except the last one
      if (block !== blocks[blocks.length - 1]) {
        plainText += '\n';
      }
    });

    return {
      blocks,
      totalCharacterCount,
      plainText,
    };
  }

  /**
   * Parse plain text with simple markdown-like formatting
   */
  parseMarkdown(markdown: string): IRichTextContent {
    const lines = markdown.split('\n');
    const blocks: ITextBlock[] = [];
    let currentIndex = 0;

    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (trimmedLine === '') {
        // Empty line creates a paragraph break
        currentIndex += line.length + 1; // +1 for newline
        continue;
      }

      let blockType = BlockType.Paragraph;
      let content = trimmedLine;
      let listType: ListType | undefined;
      let listLevel = 0;

      // Check for headers
      if (trimmedLine.startsWith('# ')) {
        blockType = BlockType.Heading1;
        content = trimmedLine.substring(2);
      } else if (trimmedLine.startsWith('## ')) {
        blockType = BlockType.Heading2;
        content = trimmedLine.substring(3);
      } else if (trimmedLine.startsWith('### ')) {
        blockType = BlockType.Heading3;
        content = trimmedLine.substring(4);
      } else if (trimmedLine.startsWith('> ')) {
        blockType = BlockType.Quote;
        content = trimmedLine.substring(2);
      } else if (trimmedLine.startsWith('```')) {
        blockType = BlockType.Code;
        content = trimmedLine.substring(3);
      } else if (trimmedLine.match(/^\s*[-*+]\s/)) {
        // Unordered list
        blockType = BlockType.ListItem;
        listType = ListType.Unordered;
        const match = trimmedLine.match(/^(\s*)([-*+])\s(.*)$/);
        if (match) {
          listLevel = Math.floor(match[1].length / 2);
          content = match[3];
        }
      } else if (trimmedLine.match(/^\s*\d+\.\s/)) {
        // Ordered list
        blockType = BlockType.ListItem;
        listType = ListType.Ordered;
        const match = trimmedLine.match(/^(\s*)\d+\.\s(.*)$/);
        if (match) {
          listLevel = Math.floor(match[1].length / 2);
          content = match[2];
        }
      }

      // Parse inline formatting
      const segments = this.parseInlineFormatting(content, currentIndex);
      
      const block: ITextBlock = {
        type: blockType,
        segments,
        listType,
        listLevel,
        startIndex: currentIndex,
        endIndex: currentIndex + line.length,
      };

      blocks.push(block);
      currentIndex += line.length + 1; // +1 for newline
    }

    // Calculate total character count and plain text
    let totalCharacterCount = 0;
    let plainText = '';
    
    blocks.forEach(block => {
      block.segments.forEach(segment => {
        totalCharacterCount += segment.text.length;
        plainText += segment.text;
      });
      plainText += '\n';
    });

    return {
      blocks,
      totalCharacterCount,
      plainText,
    };
  }

  /**
   * Clean and normalize HTML
   */
  private cleanHTML(html: string): string {
    return html
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/>\s+</g, '><') // Remove spaces between tags
      .trim();
  }

  /**
   * Parse HTML into blocks
   */
  private parseBlocks(html: string): ITextBlock[] {
    const blocks: ITextBlock[] = [];
    const blockRegex = /<(p|h[1-3]|ul|ol|li|blockquote|pre)[^>]*>(.*?)<\/\1>/gi;
    let currentIndex = 0;
    let match;

    // Handle case where HTML doesn't have block tags
    if (!blockRegex.test(html)) {
      const segments = this.parseInlineFormatting(html, 0);
      if (segments.length > 0) {
        blocks.push({
          type: BlockType.Paragraph,
          segments,
          startIndex: 0,
          endIndex: html.length,
        });
      }
      return blocks;
    }

    // Reset regex
    blockRegex.lastIndex = 0;

    while ((match = blockRegex.exec(html)) !== null) {
      const tagName = match[1].toLowerCase();
      const content = match[2];
      let blockType = BlockType.Paragraph;

      switch (tagName) {
        case 'h1':
          blockType = BlockType.Heading1;
          break;
        case 'h2':
          blockType = BlockType.Heading2;
          break;
        case 'h3':
          blockType = BlockType.Heading3;
          break;
        case 'li':
          blockType = BlockType.ListItem;
          break;
        case 'blockquote':
          blockType = BlockType.Quote;
          break;
        case 'pre':
          blockType = BlockType.Code;
          break;
      }

      const segments = this.parseInlineFormatting(content, currentIndex);
      
      if (segments.length > 0) {
        const block: ITextBlock = {
          type: blockType,
          segments,
          startIndex: currentIndex,
          endIndex: currentIndex + content.length,
        };

        blocks.push(block);
      }

      currentIndex += content.length;
    }

    return blocks;
  }

  /**
   * Parse inline formatting (bold, italic, underline)
   */
  private parseInlineFormatting(text: string, startIndex: number): ITextSegment[] {
    const segments: ITextSegment[] = [];
    const stack: Array<{ tag: string; style: Partial<ITextStyle>; startPos: number }> = [];
    
    // Regex to match formatting tags
    const tagRegex = /<(\/?)([bius]|strong|em)>/gi;
    let lastIndex = 0;
    let currentIndex = startIndex;
    let match;

    while ((match = tagRegex.exec(text)) !== null) {
      const isClosing = match[1] === '/';
      const tagName = match[2].toLowerCase();
      const matchStart = match.index;

      // Add text before this tag as a segment
      if (matchStart > lastIndex) {
        const segmentText = text.substring(lastIndex, matchStart);
        const style = this.buildCurrentStyle(stack);
        
        segments.push({
          text: segmentText,
          style,
          startIndex: currentIndex,
          endIndex: currentIndex + segmentText.length,
        });
        
        currentIndex += segmentText.length;
      }

      if (isClosing) {
        // Find matching opening tag and remove it
        for (let i = stack.length - 1; i >= 0; i--) {
          if (this.tagsMatch(stack[i].tag, tagName)) {
            stack.splice(i, 1);
            break;
          }
        }
      } else {
        // Add opening tag to stack
        const style = this.getTagStyle(tagName);
        stack.push({
          tag: tagName,
          style,
          startPos: currentIndex,
        });
      }

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      const segmentText = text.substring(lastIndex);
      const style = this.buildCurrentStyle(stack);
      
      segments.push({
        text: segmentText,
        style,
        startIndex: currentIndex,
        endIndex: currentIndex + segmentText.length,
      });
    }

    // If no segments were created, create one with the entire text
    if (segments.length === 0 && text.length > 0) {
      segments.push({
        text,
        style: { ...this.defaultStyle },
        startIndex: startIndex,
        endIndex: startIndex + text.length,
      });
    }

    return segments;
  }

  /**
   * Check if tags match for closing
   */
  private tagsMatch(openTag: string, closeTag: string): boolean {
    const tagMap: Record<string, string[]> = {
      'b': ['b', 'strong'],
      'strong': ['b', 'strong'],
      'i': ['i', 'em'],
      'em': ['i', 'em'],
      'u': ['u'],
      's': ['s'],
    };

    const openTags = tagMap[openTag] || [openTag];
    return openTags.includes(closeTag);
  }

  /**
   * Get style for a tag
   */
  private getTagStyle(tagName: string): Partial<ITextStyle> {
    switch (tagName) {
      case 'b':
      case 'strong':
        return { fontWeight: 'bold' };
      case 'i':
      case 'em':
        return { fontStyle: 'italic' };
      case 'u':
        return { textDecoration: 'underline' };
      case 's':
        return { textDecoration: 'line-through' };
      default:
        return {};
    }
  }

  /**
   * Build current style from stack
   */
  private buildCurrentStyle(stack: Array<{ tag: string; style: Partial<ITextStyle> }>): ITextStyle {
    let style: ITextStyle = { ...this.defaultStyle };
    
    // Apply styles from stack in order
    stack.forEach(item => {
      style = { ...style, ...item.style };
    });

    return style;
  }

  /**
   * Parse plain text into a single paragraph
   */
  parsePlainText(text: string): IRichTextContent {
    const segments: ITextSegment[] = [{
      text,
      style: { ...this.defaultStyle },
      startIndex: 0,
      endIndex: text.length,
    }];

    const blocks: ITextBlock[] = [{
      type: BlockType.Paragraph,
      segments,
      startIndex: 0,
      endIndex: text.length,
    }];

    return {
      blocks,
      totalCharacterCount: text.length,
      plainText: text,
    };
  }
}