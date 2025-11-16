import { type ICursor } from '../../cursor_manager';
import { type SuikaEditor } from '../../editor';
import { type ITool } from '../../tools/type';
import { createRichText } from '../services/create_rich_text';

const TYPE = 'drawRichText';
const HOTKEY = 'shift+t';

export class DrawRichTextTool implements ITool {
  static readonly type = TYPE;
  static readonly hotkey = HOTKEY;
  readonly type = TYPE;
  readonly hotkey = HOTKEY;
  cursor: ICursor = 'text';

  constructor(private editor: SuikaEditor) {}

  onActive() {
    // noop
  }

  onInactive() {
    // noop
  }

  onMoveExcludeDrag() {
    // do nothing
  }

  onStart() {
    // do nothing
  }

  onDrag() {
    // do nothing
  }

  onEnd(e: PointerEvent) {
    const point = this.editor.getSceneCursorXY(e);

    // Texto inicial com formatação limpa (tudo regular)
    const model = {
      paragraphs: [
        {
          runs: [
            {
              text: 'Digite aqui seu texto. Selecione e use os botões B/I/U para formatar!',
              fontSize: 20,
              fill: '#000000',
              fontFamily: 'Inter',
              fontWeight: 400,
              fontStyle: 'normal' as const,
            },
          ],
          textAlign: 'left' as const,
          lineHeight: 1.5,
        },
      ],
      width: 300,
      defaultFontFamily: 'Inter',
      defaultFontSize: 20,
      defaultFill: '#000000',
    };

    createRichText(this.editor, point, model);

    if (!this.editor.setting.get('keepToolSelectedAfterUse')) {
      this.editor.toolManager.setActiveTool('select');
    }
  }

  afterEnd() {
    // do nothing
  }
}
