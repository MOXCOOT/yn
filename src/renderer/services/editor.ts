import type * as Monaco from 'monaco-editor'
import { FLAG_READONLY } from '@fe/support/args'
import { isElectron, isMacOS } from '@fe/support/env'
import { registerHook, triggerHook } from '@fe/core/hook'
import { registerAction } from '@fe/core/action'
import { Alt } from '@fe/core/command'
import store from '@fe/support/store'
import { useToast } from '@fe/support/ui/toast'
import { getColorScheme } from './theme'
import { getSetting } from './setting'

let monaco: typeof Monaco
let editor: Monaco.editor.IStandaloneCodeEditor

const DEFAULT_MAC_FONT_FAMILY = 'MacEmoji, Menlo, Monaco, \'Courier New\', monospace'

/**
 * Get default editor options.
 */
export const getDefaultOptions = (): Monaco.editor.IStandaloneEditorConstructionOptions => ({
  value: '',
  theme: getColorScheme() === 'dark' ? 'vs-dark' : 'vs',
  fontSize: getSetting('editor.font-size', 16),
  wordWrap: store.state.wordWrap,
  links: !isElectron,
  // wordWrapColumn: 40,
  mouseWheelZoom: getSetting('editor.mouse-wheel-zoom', true),
  // try "same", "indent" or "none"
  wrappingIndent: 'same',
  smoothScrolling: true,
  cursorBlinking: 'smooth',
  scrollbar: getSetting('editor.minimap', true) ? {
    vertical: 'hidden',
    verticalScrollbarSize: 0
  } : undefined,
  readOnly: FLAG_READONLY,
  acceptSuggestionOnEnter: 'smart',
  unicodeHighlight: {
    ambiguousCharacters: false,
    invisibleCharacters: false,
  },
  fontFamily: isMacOS ? DEFAULT_MAC_FONT_FAMILY : undefined,
  detectIndentation: false,
  insertSpaces: true,
  tabSize: getSetting('editor.tab-size', 4),
  minimap: getSetting('editor.minimap', true) ? undefined : {
    enabled: false
  },
  lineNumbers: getSetting('editor.line-numbers', 'on'),
})

/**
 * Get Monaco
 * @returns Monaco
 */
export function getMonaco () {
  return monaco
}

/**
 * Get editor instance.
 * @returns
 */
export function getEditor () {
  return editor
}

/**
 * Get one indent
 * getOneIndent removed https://github.com/microsoft/monaco-editor/issues/1565
 * @returns
 */
export function getOneIndent () {
  const options = editor.getModel()!.getOptions()
  return options.insertSpaces ? ' '.repeat(options.tabSize) : '\t'
}

/**
 * Ensure editor is ready.
 * @returns
 */
export function whenEditorReady (): Promise<{ editor: typeof editor, monaco: typeof monaco }> {
  if (monaco && editor) {
    return Promise.resolve({ monaco, editor })
  }

  return new Promise(resolve => {
    registerHook('EDITOR_READY', resolve, true)
  })
}

/**
 * Insert text at current cursor.
 * @param text
 */
export function insert (text: string) {
  const selection = getEditor().getSelection()!
  getEditor().executeEdits('', [
    {
      range: new (getMonaco().Range)(selection.endLineNumber, selection.endColumn, selection.endLineNumber, selection.endColumn),
      text,
      forceMoveMarkers: true
    }
  ])
  getEditor().focus()
}

/**
 * Insert text at position.
 * @param position
 * @param text
 */
export function insertAt (position: Monaco.Position, text: string) {
  const editor = getEditor()
  editor.executeEdits('', [
    {
      range: new (getMonaco().Range)(position.lineNumber, position.column, position.lineNumber, position.column),
      text,
      forceMoveMarkers: true
    }
  ])
  editor.setPosition(position)
  editor.focus()
}

/**
 * Replace text value of line.
 * @param line
 * @param text
 */
export function replaceLine (line: number, text: string) {
  const length = getEditor().getModel()!.getLineLength(line)
  const editor = getEditor()
  const monaco = getMonaco()

  editor.executeEdits('', [
    {
      range: new (monaco.Range)(line, 1, line, length + 1),
      text,
      forceMoveMarkers: true
    }
  ])
  editor.setPosition(new monaco.Position(line, text.length + 1))
  editor.focus()
}

/**
 * Replace text value of lines.
 * @param lineStart
 * @param lineEnd
 * @param text
 */
export function replaceLines (lineStart: number, lineEnd: number, text: string) {
  const lineEndPos = getEditor().getModel()!.getLineLength(lineEnd) + 1
  const editor = getEditor()
  const monaco = getMonaco()

  editor.executeEdits('', [
    {
      range: new (monaco.Range)(lineStart, 1, lineEnd, lineEndPos),
      text,
      forceMoveMarkers: true
    }
  ])
  editor.setPosition(new monaco.Position(lineEnd, lineEndPos))
  editor.focus()
}

export function deleteLine (line: number) {
  const editor = getEditor()
  editor.executeEdits('', [
    {
      range: new (getMonaco().Range)(line, 1, line + 1, 1),
      text: null
    }
  ])
  editor.setPosition(new (getMonaco().Position)(line, 1))
  editor.focus()
}

/**
 * Get content of line.
 * @param line
 * @returns
 */
export function getLineContent (line: number) {
  return getEditor().getModel()!.getLineContent(line)
}

/**
 * Get content of lines.
 * @param lineStart
 * @param lineEnd
 * @returns
 */
export function getLinesContent (lineStart: number, lineEnd: number) {
  const model = getEditor().getModel()!

  const lineEndLength = model.getLineLength(lineEnd)
  const range = new (getMonaco().Range)(lineStart, 1, lineEnd, lineEndLength + 1)
  return model.getValueInRange(range)
}

/**
 * Get text value.
 * @returns
 */
export function getValue () {
  return getEditor().getModel()!.getValue(getMonaco().editor.DefaultEndOfLine.LF as number)
}

/**
 * Set text value to editor
 * @param text
 */
export function setValue (text: string) {
  const model = editor.getModel()
  const maxLine = model!.getLineCount()
  const endLineLength = model!.getLineLength(maxLine)

  editor.executeEdits('', [
    {
      range: new (getMonaco().Range)(1, 1, maxLine, endLineLength + 1),
      text,
      forceMoveMarkers: true
    }
  ])
  getEditor().focus()
}

/**
 * Replace text value.
 * @param search
 * @param val
 * @param replaceAll
 */
export function replaceValue (search: string | RegExp, val: string, replaceAll = true) {
  const editor = getEditor()
  const model = editor.getModel()
  const content = model!.getValue()
  const text = replaceAll ? content.replaceAll(search, val) : content.replace(search, val)
  setValue(text)
}

/**
 * Get editor selection.
 * @returns
 */
export function getSelectionInfo () {
  const selection = getEditor().getSelection()!

  return {
    line: selection.positionLineNumber,
    column: selection.positionColumn,
    lineCount: getEditor().getModel()!.getLineCount(),
    textLength: getValue().length,
    selectedLength: getEditor().getModel()!.getValueInRange(selection).length
  }
}

/**
 * Toggle editor word wrap.
 */
export function toggleWrap () {
  const wrapInfo = getEditor().getOption(monaco.editor.EditorOption.wrappingInfo)
  const isWrapping = wrapInfo.isViewportWrapping
  if (wrapInfo.isDominatedByLongLines) {
    useToast().show('warning', 'Word warp dominated by long lines')
    return
  }

  store.commit('setWordWrap', (isWrapping ? 'off' : 'on'))
}

export function toggleTypewriterMode () {
  store.commit('setTypewriterMode', !store.state.typewriterMode)
}

registerAction({ name: 'editor.toggle-wrap', handler: toggleWrap, keys: [Alt, 'w'] })

registerHook('MONACO_BEFORE_INIT', ({ monaco }) => {
  monaco.editor.defineTheme('vs', {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'keyword', foreground: '#0062d1' },
      { token: 'attribute.name.html', foreground: '#0062d1' },
      { token: 'attribute.value.html', foreground: '#e52a24' }
    ],
    colors: {
      'editor.background': '#ffffff',
      'minimap.background': '#f2f2f2',
    }
  })

  monaco.editor.defineTheme('vs-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [],
    colors: {
      'editor.background': '#131416',
      'minimap.background': '#101113',
    }
  })
})

registerHook('MONACO_READY', (payload) => {
  monaco = payload.monaco
  editor = payload.editor

  triggerHook('EDITOR_READY', payload)
})

registerHook('MONACO_CHANGE_VALUE', payload => {
  triggerHook('EDITOR_CHANGE', payload)
})

registerHook('THEME_CHANGE', () => {
  monaco?.editor.setTheme(getColorScheme() === 'dark' ? 'vs-dark' : 'vs')
})

store.watch(state => state.wordWrap, (wordWrap) => {
  whenEditorReady().then(({ editor }) => {
    editor.updateOptions({ wordWrap })
  })
})

whenEditorReady().then(({ editor }) => {
  // typewriter mode
  editor.onDidChangeCursorPosition(e => {
    if (store.state.typewriterMode) {
      const sources = ['deleteLeft', 'keyboard']
      if (sources.includes(e.source) && (e.reason === 0 || e.reason === 3)) {
        editor.revealPositionInCenter(e.position)
      }
    }
  })
})

registerHook('SETTING_FETCHED', () => {
  whenEditorReady().then(({ editor }) => {
    editor.updateOptions(getDefaultOptions())
  })
})

registerHook('SETTING_CHANGED', ({ changedKeys }) => {
  whenEditorReady().then(({ editor }) => {
    if (changedKeys.includes('editor.mouse-wheel-zoom')) {
      editor.trigger('keyboard', 'editor.action.fontZoomReset', {})
    }
  })
})
