export const DOUBLE_PI = Math.PI * 2;

export const HALF_PI = Math.PI / 2;

export const FONT_FILES = {
  // ========== ROBOTO ==========
  Roboto: './font_files/roboto/Roboto-Regular.ttf',
  'Roboto-400': './font_files/roboto/Roboto-Regular.ttf',
  'Roboto-700': './font_files/roboto/Roboto-Bold.ttf',
  'Roboto-400italic': './font_files/roboto/Roboto-Italic.ttf',
  'Roboto-700italic': './font_files/roboto/Roboto-BoldItalic.ttf',

  // ========== INTER (Bold muito visível!) ==========
  Inter: './font_files/inter/Inter-Regular.ttf',
  'Inter-400': './font_files/inter/Inter-Regular.ttf',
  'Inter-700': './font_files/inter/Inter-Bold.ttf',
  'Inter-400italic': './font_files/inter/Inter-Italic.ttf',
  'Inter-700italic': './font_files/inter/Inter-BoldItalic.ttf',

  // ========== OPEN SANS ==========
  'Open Sans': './font_files/open-sans/OpenSans-Regular.ttf',
  'Open Sans-400': './font_files/open-sans/OpenSans-Regular.ttf',
  'Open Sans-700': './font_files/open-sans/OpenSans-Bold.ttf',
  'Open Sans-400italic': './font_files/open-sans/OpenSans-Italic.ttf',
  'Open Sans-700italic': './font_files/open-sans/OpenSans-BoldItalic.ttf',

  // ========== LATO ==========
  // Lato temporariamente desabilitado - arquivos corrompidos
  // TODO: Baixar Lato de fonte confiável
  // Lato: './font_files/lato/Lato-Regular.ttf',
  // 'Lato-400': './font_files/lato/Lato-Regular.ttf',
  // 'Lato-700': './font_files/lato/Lato-Bold.ttf',
  // 'Lato-400italic': './font_files/lato/Lato-Italic.ttf',
  // 'Lato-700italic': './font_files/lato/Lato-BoldItalic.ttf',

  // ========== SOURCE HAN SANS (Chinese support) ==========
  'Source Han Sans CN':
    './font_files/source-han-sans/SourceHanSansCN-Regular.otf',
  'Source Han Sans CN-400':
    './font_files/source-han-sans/SourceHanSansCN-Regular.otf',

  // ========== SMILEY SANS ==========
  'Smiley Sans': './font_files/smiley-sans/smiley-sans-oblique.otf',
};

/**
 * Font families that support all 4 variants (regular, bold, italic, bold italic)
 * These are safe to use with formatting buttons (B/I/U)
 *
 * To add a new font:
 * 1. Add all 4 variant files (.ttf/.otf) to public/font_files/[font-name]/
 * 2. Register variants in FONT_FILES above:
 *    - FontName: './font_files/[font-name]/FontName-Regular.ttf'
 *    - FontName-400: './font_files/[font-name]/FontName-Regular.ttf'
 *    - FontName-700: './font_files/[font-name]/FontName-Bold.ttf'
 *    - FontName-400italic: './font_files/[font-name]/FontName-Italic.ttf'
 *    - FontName-700italic: './font_files/[font-name]/FontName-BoldItalic.ttf'
 * 3. Add 'FontName' to this array
 */
export const RICHTEXT_SUPPORTED_FONTS = [
  'Roboto',
  'Inter',
  'Open Sans',
] as const;
