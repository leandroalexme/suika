/**
 * Rich Text Module
 *
 * Unified export point for all rich text functionality
 */

// Graphics - Rendering & Layout
export * from './graphics';
export { LayoutEngine } from './graphics/layout-engine';
export { OpenTypeLayoutRenderer } from './graphics/opentype-layout-renderer';
export { SuikaRichText } from './graphics/rich-text';

// Editor - Editing & Selection
export * from './editor';
export { RangeManager } from './editor/range_manager';
export { RichTextEditor } from './editor/rich_text_editor';

// Font - Font Management
export * from './font';
export { fontManager } from './font/font_manager';

// Tools - Editor Tools
export * from './tools';
export { DrawRichTextTool } from './tools/tool_draw_rich_text';

// Services - Factories
export * from './services';
export { createRichText } from './services/create_rich_text';

// Types - Interfaces & Models
export * from './types';
export type { Paragraph, RichTextModel, TextRun } from './types/models';
