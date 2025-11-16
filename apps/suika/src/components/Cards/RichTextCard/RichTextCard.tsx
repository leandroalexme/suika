import './RichTextCard.scss';

import { SuikaRichText } from '@suika/core';
import React, { useContext, useEffect, useState } from 'react';
import { useIntl } from 'react-intl';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FONT_FILES, RICHTEXT_SUPPORTED_FONTS } from '@/constant';

import { EditorContext } from '../../../context';
import NumberInput from '../../input/NumberInput';
import { BaseCard } from '../BaseCard';

export const RichTextCard: React.FC = () => {
  const editor = useContext(EditorContext);

  const [fontSize, setFontSize] = useState(16);
  const [fontFamily, setFontFamily] = useState('Roboto');
  const [lineHeight, setLineHeight] = useState(1.3);
  const [width, setWidth] = useState(300);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (!editor) return;

    const updateRichTextInfo = () => {
      const items = editor.selectedElements.getItems();
      const richTextItem = items.find(
        (item) => item instanceof SuikaRichText,
      ) as SuikaRichText | undefined;

      if (richTextItem) {
        const model = richTextItem.attrs.model;
        setFontSize(model.defaultFontSize || 16);
        setFontFamily(model.defaultFontFamily || 'Roboto');
        setLineHeight(model.paragraphs[0]?.lineHeight || 1.3);
        setWidth(model.width || 300);
        setIsEditing(richTextItem.getIsEditing());
      }
    };

    updateRichTextInfo();
    editor.sceneGraph.on('render', updateRichTextInfo);

    return () => {
      editor.sceneGraph.off('render', updateRichTextInfo);
    };
  }, [editor]);

  const handleBold = () => {
    if (!editor) return;
    const items = editor.selectedElements.getItems();
    const richTextItems = items.filter((item) => item instanceof SuikaRichText);

    for (const item of richTextItems) {
      const richText = item as SuikaRichText;

      // If editing with selection, apply to selection
      if (richText.getIsEditing() && richText.hasSelection()) {
        richText.applyBold();
      } else if (!richText.getIsEditing()) {
        // If not editing, apply to ALL text
        const textLength = richText.getTextLength();
        if (textLength > 0) {
          // Temporarily select all text
          const originalStart = richText.selectionStart;
          const originalEnd = richText.selectionEnd;

          richText.selectionStart = 0;
          richText.selectionEnd = textLength;
          richText.applyBold();

          // Restore selection
          richText.selectionStart = originalStart;
          richText.selectionEnd = originalEnd;
        }
      }
    }

    editor.render();
  };

  const handleItalic = () => {
    if (!editor) return;
    const items = editor.selectedElements.getItems();
    const richTextItems = items.filter((item) => item instanceof SuikaRichText);

    for (const item of richTextItems) {
      const richText = item as SuikaRichText;

      // If editing with selection, apply to selection
      if (richText.getIsEditing() && richText.hasSelection()) {
        richText.applyItalic();
      } else if (!richText.getIsEditing()) {
        // If not editing, apply to ALL text
        const textLength = richText.getTextLength();
        if (textLength > 0) {
          // Temporarily select all text
          const originalStart = richText.selectionStart;
          const originalEnd = richText.selectionEnd;

          richText.selectionStart = 0;
          richText.selectionEnd = textLength;
          richText.applyItalic();

          // Restore selection
          richText.selectionStart = originalStart;
          richText.selectionEnd = originalEnd;
        }
      }
    }

    editor.render();
  };

  const handleUnderline = () => {
    if (!editor) return;
    const items = editor.selectedElements.getItems();
    const richTextItems = items.filter((item) => item instanceof SuikaRichText);

    for (const item of richTextItems) {
      const richText = item as SuikaRichText;

      // If editing with selection, apply to selection
      if (richText.getIsEditing() && richText.hasSelection()) {
        richText.applyUnderline();
      } else if (!richText.getIsEditing()) {
        // If not editing, apply to ALL text
        const textLength = richText.getTextLength();
        if (textLength > 0) {
          // Temporarily select all text
          const originalStart = richText.selectionStart;
          const originalEnd = richText.selectionEnd;

          richText.selectionStart = 0;
          richText.selectionEnd = textLength;
          richText.applyUnderline();

          // Restore selection
          richText.selectionStart = originalStart;
          richText.selectionEnd = originalEnd;
        }
      }
    }

    editor.render();
  };

  const handleColorChange = (color: string) => {
    if (!editor) return;
    const items = editor.selectedElements.getItems();
    const richTextItems = items.filter((item) => item instanceof SuikaRichText);

    for (const item of richTextItems) {
      const richText = item as SuikaRichText;

      // If editing with selection, apply to selection
      if (richText.getIsEditing() && richText.hasSelection()) {
        richText.applyColor(color);
      } else if (!richText.getIsEditing()) {
        // If not editing, apply to ALL text
        const textLength = richText.getTextLength();
        if (textLength > 0) {
          // Temporarily select all text
          const originalStart = richText.selectionStart;
          const originalEnd = richText.selectionEnd;

          richText.selectionStart = 0;
          richText.selectionEnd = textLength;
          richText.applyColor(color);

          // Restore selection
          richText.selectionStart = originalStart;
          richText.selectionEnd = originalEnd;
        }
      }
    }

    editor.render();
  };

  const handleFontSizeChange = (size: number) => {
    if (!editor) return;
    const items = editor.selectedElements.getItems();
    const richTextItems = items.filter((item) => item instanceof SuikaRichText);

    for (const item of richTextItems) {
      const richText = item as SuikaRichText;

      // If editing with selection, apply to selection
      if (richText.getIsEditing() && richText.hasSelection()) {
        richText.applyFontSize(size);
      } else if (!richText.getIsEditing()) {
        // If not editing, apply to ALL text
        const textLength = richText.getTextLength();
        if (textLength > 0) {
          // Temporarily select all text
          const originalStart = richText.selectionStart;
          const originalEnd = richText.selectionEnd;

          richText.selectionStart = 0;
          richText.selectionEnd = textLength;
          richText.applyFontSize(size);

          // Restore selection
          richText.selectionStart = originalStart;
          richText.selectionEnd = originalEnd;
        }

        // Also update default for new text
        const updatedModel = {
          ...richText.attrs.model,
          defaultFontSize: size,
        };
        richText.updateAttrs({ model: updatedModel });
      } else {
        // Editing without selection: update default only
        const updatedModel = {
          ...richText.attrs.model,
          defaultFontSize: size,
        };
        richText.updateAttrs({ model: updatedModel });
      }
    }

    setFontSize(size);
    editor.render();
  };

  const handleFontFamilyChange = (family: string) => {
    if (!editor) return;
    const items = editor.selectedElements.getItems();
    const richTextItems = items.filter((item) => item instanceof SuikaRichText);

    for (const item of richTextItems) {
      const richText = item as SuikaRichText;

      // If editing with selection, apply to selection
      if (richText.getIsEditing() && richText.hasSelection()) {
        richText.applyFontFamily(family);
      } else if (!richText.getIsEditing()) {
        // If not editing, apply to ALL text
        const textLength = richText.getTextLength();
        if (textLength > 0) {
          // Temporarily select all text
          const originalStart = richText.selectionStart;
          const originalEnd = richText.selectionEnd;

          richText.selectionStart = 0;
          richText.selectionEnd = textLength;
          richText.applyFontFamily(family);

          // Restore selection
          richText.selectionStart = originalStart;
          richText.selectionEnd = originalEnd;
        }

        // Also update default for new text
        const updatedModel = {
          ...richText.attrs.model,
          defaultFontFamily: family,
        };
        richText.updateAttrs({ model: updatedModel });
      } else {
        // Editing without selection: update default only
        const updatedModel = {
          ...richText.attrs.model,
          defaultFontFamily: family,
        };
        richText.updateAttrs({ model: updatedModel });
      }
    }

    setFontFamily(family);
    editor.render();
  };

  const handleLineHeightChange = (value: number) => {
    if (!editor) return;
    const items = editor.selectedElements.getItems();
    const richTextItems = items.filter((item) => item instanceof SuikaRichText);

    for (const item of richTextItems) {
      const richText = item as SuikaRichText;
      const updatedModel = {
        ...richText.attrs.model,
        paragraphs: richText.attrs.model.paragraphs.map((p) => ({
          ...p,
          lineHeight: value,
        })),
      };
      richText.updateAttrs({ model: updatedModel });
    }

    setLineHeight(value);
    editor.render();
  };

  const handleWidthChange = (value: number) => {
    if (!editor) return;
    const items = editor.selectedElements.getItems();
    const richTextItems = items.filter((item) => item instanceof SuikaRichText);

    for (const item of richTextItems) {
      const richText = item as SuikaRichText;
      const updatedModel = {
        ...richText.attrs.model,
        width: value,
      };
      richText.updateAttrs({ model: updatedModel });
    }

    setWidth(value);
    editor.render();
  };

  return (
    <BaseCard title="Rich Text">
      <div className="rich-text-properties">
        {/* Formatting Buttons - Only show if editing with selection */}
        {isEditing && (
          <div className="property-row">
            <label>Format</label>
            <div className="format-buttons">
              <button
                className="format-btn"
                onClick={handleBold}
                title="Bold (Cmd+B)"
              >
                <strong>B</strong>
              </button>
              <button
                className="format-btn"
                onClick={handleItalic}
                title="Italic (Cmd+I)"
              >
                <em>I</em>
              </button>
              <button
                className="format-btn"
                onClick={handleUnderline}
                title="Underline (Cmd+U)"
              >
                <u>U</u>
              </button>
            </div>
          </div>
        )}

        {/* Text Color - Only show if editing with selection */}
        {isEditing && (
          <div className="property-row">
            <label>Text Color</label>
            <input
              type="color"
              onChange={(e) => handleColorChange(e.target.value)}
              title="Text Color"
            />
          </div>
        )}

        {/* Font Family - Only fonts with full variant support (B/I/U work correctly) */}
        <div className="property-row">
          <label>Font Family</label>
          <Select value={fontFamily} onValueChange={handleFontFamilyChange}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select font family" />
            </SelectTrigger>
            <SelectContent className="w-full">
              {RICHTEXT_SUPPORTED_FONTS.map((font) => (
                <SelectItem key={font} value={font}>
                  {font}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Font Size */}
        <div className="property-row">
          <label>Font Size</label>
          <NumberInput
            value={fontSize}
            onChange={handleFontSizeChange}
            onIncrement={() => handleFontSizeChange(fontSize + 1)}
            onDecrement={() => {
              if (fontSize - 1 < 8) return;
              handleFontSizeChange(fontSize - 1);
            }}
            min={8}
            max={200}
          />
        </div>

        {/* Line Height */}
        <div className="property-row">
          <label>Line Height</label>
          <NumberInput
            value={lineHeight}
            onChange={handleLineHeightChange}
            onIncrement={() =>
              handleLineHeightChange(Number((lineHeight + 0.1).toFixed(1)))
            }
            onDecrement={() => {
              if (lineHeight - 0.1 < 0.5) return;
              handleLineHeightChange(Number((lineHeight - 0.1).toFixed(1)));
            }}
            min={0.5}
            max={3}
          />
        </div>

        {/* Width */}
        <div className="property-row">
          <label>Width</label>
          <NumberInput
            value={width}
            onChange={handleWidthChange}
            onIncrement={() => handleWidthChange(width + 10)}
            onDecrement={() => {
              if (width - 10 < 50) return;
              handleWidthChange(width - 10);
            }}
            min={50}
            max={2000}
          />
        </div>
      </div>
    </BaseCard>
  );
};
