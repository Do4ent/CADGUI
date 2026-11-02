import { TextEditor, type TextEditorProps } from './TextEditor';

/** The inspector shares the same complete, transactional property form. */
export function TextInspector(props: Omit<TextEditorProps, 'onApply'>) {
  return <TextEditor {...props} />;
}
