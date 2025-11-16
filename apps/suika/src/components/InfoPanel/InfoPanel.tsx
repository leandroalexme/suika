import './style.scss';

import { type SuikaGraphics, SuikaRichText } from '@suika/core';
import { type FC, useContext, useEffect, useState } from 'react';
import { FormattedMessage } from 'react-intl';

import { EditorContext } from '../../context';
import { AlignCard } from '../Cards/AlignCard';
import { ElementsInfoCards } from '../Cards/ElementsInfoCard';
import { FillCard } from '../Cards/FillCard';
import { LayerInfoCard } from '../Cards/LayerInfoCard';
import { RichTextCard } from '../Cards/RichTextCard';
import { StrokeCard } from '../Cards/StrokeCard';
import { TypographyCard } from '../Cards/TypographyCard';
import { DebugPanel } from '../DebugPanel';

enum PanelType {
  Global = 'Global',
  SelectedElements = 'SelectedElements',
}

export const InfoPanel: FC = () => {
  const editor = useContext(EditorContext);
  const [type, setType] = useState(PanelType.Global);
  const [hasRichText, setHasRichText] = useState(false);
  // select panel type by selected elements

  const showDebugPanel = localStorage.getItem('suika-debug-panel') === 'true';

  useEffect(() => {
    if (editor) {
      const handler = (items: SuikaGraphics[]) => {
        setType(items.length ? PanelType.SelectedElements : PanelType.Global);
        setHasRichText(items.some((item) => item instanceof SuikaRichText));
      };
      editor.selectedElements.on('itemsChange', handler);

      return () => {
        editor.selectedElements.off('itemsChange', handler);
      };
    }
  }, [editor]);

  return (
    <div className="info-panel" onKeyDown={(e) => e.stopPropagation()}>
      {type === PanelType.SelectedElements && (
        <>
          <AlignCard />
          <ElementsInfoCards />
          <TypographyCard />
          {hasRichText && <RichTextCard />}
          <LayerInfoCard />
          <FillCard key="fill" />
          <StrokeCard key="stroke" />
        </>
      )}
      {type === PanelType.Global && (
        <div className="empty-text">
          <FormattedMessage id="noSelectedShapes" />
        </div>
      )}

      {showDebugPanel && <DebugPanel />}
    </div>
  );
};
