/**
 * Font Manager for loading and caching OpenType fonts
 * Supports:
 * - Local fonts (custom URLs)
 * - Google Fonts (API)
 * - Variants (Regular, Bold, Italic, Bold Italic)
 */

import * as opentype from 'opentype.js';

class FontManager {
  private fonts: Map<string, opentype.Font> = new Map();
  private loading: Map<string, Promise<opentype.Font>> = new Map();
  private googleFontsCache: Map<string, string> = new Map(); // fontFamily -> CSS URL

  /**
   * Loads a font by name (tries system fonts first)
   */
  async loadFont(
    fontFamily: string,
    fontURL?: string,
  ): Promise<opentype.Font | null> {
    // Check if already in cache
    if (this.fonts.has(fontFamily)) {
      return this.fonts.get(fontFamily)!;
    }

    // Check if already loading
    if (this.loading.has(fontFamily)) {
      return await this.loading.get(fontFamily)!;
    }

    // Start loading
    const loadPromise = this.doLoadFont(fontFamily, fontURL);
    this.loading.set(fontFamily, loadPromise);

    try {
      const font = await loadPromise;
      this.fonts.set(fontFamily, font);
      this.loading.delete(fontFamily);
      return font;
    } catch (error) {
      console.error(`Failed to load font ${fontFamily}:`, error);
      this.loading.delete(fontFamily);
      return null;
    }
  }

  /**
   * Loads multiple fonts from an object { fontName: fontURL }
   * Compatibility with old API
   * Supports format 'Roboto-400', 'Roboto-700', etc.
   */
  async loadFonts(fonts: Record<string, string>): Promise<void> {
    const promises = Object.entries(fonts).map(async ([fontKey, fontURL]) => {
      const font = await this.loadFont(fontKey, fontURL);

      // If font key follows "FamilyName-variant" pattern (e.g., "Roboto-400")
      // Also store with the standard key expected by getFontWithVariant
      const variantMatch = fontKey.match(/^(.+)-(\d{3}(?:italic)?)$/);
      if (variantMatch && font) {
        const [, familyName, variant] = variantMatch;
        const standardKey = this.getFontKey(familyName, variant);
        // Store with standardized key if different
        if (standardKey !== fontKey) {
          this.fonts.set(standardKey, font);
        }
      }

      return font;
    });
    await Promise.all(promises);
  }

  /**
   * Gets an already loaded font (synchronous)
   */
  getFont(fontFamily: string): opentype.Font | null {
    return this.fonts.get(fontFamily) || null;
  }

  /**
   * Checks if a font is loaded
   */
  hasFont(fontFamily: string): boolean {
    return this.fonts.has(fontFamily);
  }

  /**
   * Removes a font from cache
   */
  removeFont(fontFamily: string): void {
    this.fonts.delete(fontFamily);
  }

  /**
   * Clears all fonts
   */
  clear(): void {
    this.fonts.clear();
    this.loading.clear();
    this.googleFontsCache.clear();
  }

  // Google Fonts is not supported because OpenType.js doesn't support WOFF2
  // Use local TTF/OTF fonts instead

  /**
   * Loads custom font from a URL
   * @param fontFamily - Font name
   * @param fontURL - URL of the .ttf, .otf, .woff, or .woff2 file
   * @param variant - Variant (e.g., '400', '700', '400italic')
   */
  async loadCustomFont(
    fontFamily: string,
    fontURL: string,
    variant: string = '400',
  ): Promise<void> {
    const fontKey = this.getFontKey(fontFamily, variant);
    const font = await opentype.load(fontURL);
    this.fonts.set(fontKey, font);
  }

  /**
   * Generates unique key for a font + variant
   * @param fontFamily - Font name
   * @param variant - Variant (e.g., '400', '700', '400italic', '700italic')
   * @returns Unique key (e.g., 'Roboto-400', 'Roboto-700', 'Roboto-400italic')
   */
  private getFontKey(fontFamily: string, variant: string = '400'): string {
    return `${fontFamily}-${variant}`;
  }

  /**
   * Gets font with variant support
   * @param fontFamily - Font name
   * @param fontWeight - Font weight (400, 700, 'bold', 'normal', etc)
   * @param fontStyle - Style ('normal' or 'italic')
   * @returns OpenType font or null
   */
  getFontWithVariant(
    fontFamily: string,
    fontWeight: string | number = 400,
    fontStyle: 'normal' | 'italic' = 'normal',
  ): opentype.Font | null {
    // Normalize weight
    let weight: string;
    if (typeof fontWeight === 'string') {
      // Map CSS values to numbers
      const weightMap: Record<string, string> = {
        normal: '400',
        bold: '700',
        lighter: '300',
        bolder: '700',
      };
      weight = weightMap[fontWeight.toLowerCase()] || fontWeight;
    } else {
      weight = String(fontWeight);
    }

    const variant = fontStyle === 'italic' ? `${weight}italic` : weight;
    const fontKey = this.getFontKey(fontFamily, variant);

    // Try specific variant
    let font = this.fonts.get(fontKey);
    if (font) {
      return font;
    }

    // Fallback: try regular variant
    const regularKey = this.getFontKey(fontFamily, '400');
    font = this.fonts.get(regularKey);
    if (font) {
      return font;
    }

    // Fallback: try just family name (compatibility with old code)
    font = this.fonts.get(fontFamily);
    if (font) {
      return font;
    }

    // Font not found
    return null;
  }

  /**
   * Loads a font from system or URL
   */
  private async doLoadFont(
    fontFamily: string,
    fontURL?: string,
  ): Promise<opentype.Font> {
    if (fontURL) {
      // Carregar de URL fornecida
      return await opentype.load(fontURL);
    }

    // Tentar carregar fonte do sistema usando Canvas API
    return await this.loadSystemFont(fontFamily);
  }

  /**
   * Loads a system font by converting to OpenType
   * Uses fallback approach: tries common fonts first, then uses Canvas
   */
  private async loadSystemFont(fontFamily: string): Promise<opentype.Font> {
    // Don't try to load remote fonts by default
    // Just use fallback
    return this.createFallbackFont(fontFamily);
  }

  /**
   * Creates a basic fallback font (for development only)
   * In production, all fonts should be provided explicitly
   */
  private createFallbackFont(fontFamily: string): opentype.Font {
    // Create glyphs for basic characters
    const glyphs: opentype.Glyph[] = [];

    // Glyph .notdef (index 0)
    glyphs.push(
      new opentype.Glyph({
        name: '.notdef',
        unicode: 0,
        advanceWidth: 500,
        path: new opentype.Path(),
      }),
    );

    // Create basic glyphs for A-Z, a-z, 0-9, space and common punctuation
    const chars =
      ' ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,!?-';
    for (let i = 0; i < chars.length; i++) {
      const char = chars[i];
      const path = new opentype.Path();

      // Create simple rectangle as glyph
      if (char !== ' ') {
        path.moveTo(50, 0);
        path.lineTo(450, 0);
        path.lineTo(450, 700);
        path.lineTo(50, 700);
        path.close();
      }

      glyphs.push(
        new opentype.Glyph({
          name: char === ' ' ? 'space' : `char${char.charCodeAt(0)}`,
          unicode: char.charCodeAt(0),
          advanceWidth: char === ' ' ? 250 : 500,
          path: path,
        }),
      );
    }

    const fallbackFont = new opentype.Font({
      familyName: fontFamily,
      styleName: 'Regular',
      unitsPerEm: 1000,
      ascender: 800,
      descender: -200,
      glyphs: glyphs,
    });

    // Add empty kerningPairs to avoid errors
    (fallbackFont as any).kerningPairs = {};

    return fallbackFont;
  }

  /**
   * Preloads common fonts
   * NOTE: Removed auto-load. Fonts are loaded via Editor.tsx with FONT_FILES
   */
  async preloadCommonFonts(): Promise<void> {
    // Deprecated method, kept for compatibility
  }
}

// Singleton
export const fontManager = new FontManager();
