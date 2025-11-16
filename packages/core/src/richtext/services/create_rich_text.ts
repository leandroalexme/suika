import { type IPoint } from '@suika/geo';

import { type SuikaEditor } from '../../editor';
import { GraphicsObjectSuffix } from '../../graphics';
import { getNoConflictObjectName } from '../../utils';
import { SuikaRichText } from '../graphics/rich-text';
import { type RichTextModel } from '../types/models';

export const createRichText = (
  editor: SuikaEditor,
  point: IPoint,
  model: RichTextModel,
) => {
  const currentCanvas = editor.doc.getCurrentCanvas();
  const objectName = getNoConflictObjectName(
    currentCanvas,
    GraphicsObjectSuffix.Text,
  );

  const richText = new SuikaRichText(
    {
      objectName,
      model,
      width: model.width ?? 300,
    },
    {
      doc: editor.doc,
      advancedAttrs: {
        x: point.x,
        y: point.y,
      },
    },
  );

  currentCanvas.insertChild(richText);
  editor.sceneGraph.addItems([richText]);
  editor.selectedElements.setItems([richText]);
  editor.sceneGraph.render();

  return richText;
};
