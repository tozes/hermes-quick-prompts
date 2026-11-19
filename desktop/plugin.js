// Quick prompts: one-click buttons above the chat input. A click fills the input with that
// prompt and puts the caret there; it never sends. Edit the list under Settings → Plugins →
// Quick prompts. Saved per app/browser through the plugin SDK's storage (localStorage).
import { host, atom, useValue, Button, Input, Textarea, ListRow } from '@hermes/plugin-sdk'
import { jsx, jsxs } from 'react/jsx-runtime'

const STORAGE_KEY = 'prompts-v1'
const MAX_PROMPTS = 24
const DEFAULT_PROMPTS = [
  { label: 'Status', text: "What's the current status?" },
  { label: 'Summarize', text: 'Summarize this conversation so far.' },
  { label: 'Next steps', text: 'What are the next steps?' }
]

const CSS = `
.qp-row { display: flex; flex-wrap: wrap; gap: 6px; padding: 2px 0 4px; }
.qp-chip { font-size: 12px; line-height: 18px; padding: 1px 10px; border-radius: 999px; cursor: pointer;
  max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  border: 1px solid color-mix(in srgb, var(--ui-text-primary, currentColor) 18%, transparent);
  color: var(--ui-text-secondary, inherit); background: transparent; outline: none; }
.qp-chip:hover { color: var(--ui-text-primary, inherit);
  background: color-mix(in srgb, var(--ui-text-primary, currentColor) 6%, transparent); }
.qp-chip:focus-visible { box-shadow: 0 0 0 1.5px var(--ui-accent, currentColor); }
.qp-list { display: flex; flex-direction: column; gap: 12px; }
.qp-item { display: flex; flex-direction: column; gap: 6px; padding: 10px; border-radius: 8px;
  border: 1px solid color-mix(in srgb, var(--ui-text-primary, currentColor) 12%, transparent); }
.qp-item-top { display: flex; gap: 6px; align-items: center; }
.qp-item-top > :first-child { flex: 1; min-width: 0; }
.qp-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
.qp-hint { font-size: 12px; color: var(--ui-text-secondary, inherit); }
`

// Accept only well-formed rows from storage, so a hand-edited or corrupt value can't break the composer.
function clean(list) {
  if (!Array.isArray(list)) return null
  return list
    .filter(p => p && typeof p.text === 'string' && typeof p.label === 'string')
    .slice(0, MAX_PROMPTS)
    .map(p => ({ label: p.label, text: p.text }))
}

const chipLabel = p => p.label.trim() || p.text.trim().slice(0, 24)

async function fill(text) {
  // null = the composer the user is in; the SDK never writes into another session's draft.
  if (await host.composer.setDraft(null, text)) host.composer.focus(null)
}

function QuickPrompts({ prompts }) {
  const list = useValue(prompts).filter(p => p.text.trim())
  if (!list.length) return null
  return jsx('div', {
    className: 'qp-row',
    role: 'toolbar',
    'aria-label': 'Quick prompts',
    children: list.map((p, i) =>
      jsx('button', { type: 'button', className: 'qp-chip', title: p.text, onClick: () => fill(p.text), children: chipLabel(p) }, i)
    )
  })
}

function SettingsPage({ prompts, save }) {
  const list = useValue(prompts)
  const edit = (i, patch) => save(list.map((p, j) => (j === i ? { ...p, ...patch } : p)))
  const move = (i, d) => {
    const next = [...list]
    ;[next[i], next[i + d]] = [next[i + d], next[i]]
    save(next)
  }
  const remove = i => save(list.filter((_, j) => j !== i))

  const item = (p, i) =>
    jsxs('div', {
      className: 'qp-item',
      children: [
        jsxs('div', {
          className: 'qp-item-top',
          children: [
            jsx(Input, { value: p.label, maxLength: 40, placeholder: 'Button label', 'aria-label': 'Button label', onChange: e => edit(i, { label: e.target.value }) }),
            jsx(Button, { variant: 'ghost', size: 'sm', disabled: i === 0, 'aria-label': 'Move up', onClick: () => move(i, -1), children: '↑' }),
            jsx(Button, { variant: 'ghost', size: 'sm', disabled: i === list.length - 1, 'aria-label': 'Move down', onClick: () => move(i, 1), children: '↓' }),
            jsx(Button, { variant: 'ghost', size: 'sm', onClick: () => remove(i), children: 'Remove' })
          ]
        }),
        jsx(Textarea, { value: p.text, rows: 2, placeholder: 'Prompt text', 'aria-label': 'Prompt text', onChange: e => edit(i, { text: e.target.value }) })
      ]
    }, i)

  return jsxs('div', {
    className: 'flex flex-col',
    children: [
      jsx(ListRow, {
        title: 'Prompts',
        description: 'Each prompt shows as a button above the chat input. A click fills the input; you still press Send. Changes save as you type. Saved in this app or browser only.'
      }),
      jsx('div', { className: 'qp-list', children: list.length ? list.map(item) : jsx('p', { className: 'qp-hint', children: 'No prompts yet, so no buttons show.' }) }),
      jsxs('div', {
        className: 'qp-actions',
        children: [
          jsx(Button, { variant: 'outline', size: 'sm', disabled: list.length >= MAX_PROMPTS, onClick: () => save([...list, { label: '', text: '' }]), children: 'Add prompt' }),
          jsx(Button, { variant: 'ghost', size: 'sm', onClick: () => save(DEFAULT_PROMPTS), children: 'Reset to defaults' })
        ]
      })
    ]
  })
}

export default {
  id: 'quick-prompts',
  name: 'Quick prompts',
  description: 'One-click prompt buttons above the chat input. A click fills the input; it never sends.',
  register(ctx) {
    const style = document.createElement('style')
    style.textContent = CSS
    document.head.appendChild(style)
    ctx.onDispose(() => style.remove())

    const prompts = atom(clean(ctx.storage.get(STORAGE_KEY, null)) ?? DEFAULT_PROMPTS)
    const save = list => {
      prompts.set(list)
      ctx.storage.set(STORAGE_KEY, list)
    }

    ctx.register({ id: 'row', area: 'composer.top', render: () => jsx(QuickPrompts, { prompts }) })
    // Feature-detected so the buttons still load on hosts that predate plugin settings pages.
    ctx.registerSettingsPage?.({
      id: 'settings',
      title: 'Quick prompts',
      icon: 'comment',
      render: () => jsx(SettingsPage, { prompts, save })
    })
  }
}
