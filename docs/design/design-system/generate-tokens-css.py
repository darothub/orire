#!/usr/bin/env python3
"""Generate tokens.css from tokens.json. Run from docs/design/design-system/.
Usage: python3 generate-tokens-css.py  ->  writes tokens.css
Keep tokens.json as the single source of truth; regenerate tokens.css on change."""
import json, pathlib

HERE = pathlib.Path(__file__).parent
t = json.load(open(HERE / 'tokens.json'))
out = ['/* Orire — generated from tokens.json. Do not edit by hand. */', '']

base = [':root {',
        f'  --font-display: {t["type"]["families"]["display"]};',
        f'  --font-sans: {t["type"]["families"]["sans"]};', '']
for grp in ('spacing', 'radius', 'shadow'):
    base.append(f'  /* {grp} */')
    for tok in t[grp]['tokens']:
        base.append(f'  --{tok["name"]}: {tok["value"]};')
    base.append('')
base.append('}')
out += ['\n'.join(base), '']

def color_block(sel, theme):
    lines = [f'{sel} {{']
    for tok in t['color']['tokens']:
        v = tok['value']
        lines.append(f'  --{tok["name"]}: {v[theme] if isinstance(v, dict) else v};')
    lines.append('}')
    return '\n'.join(lines)

themes = [th['id'] for th in t['color']['themes']]
out += [f'/* color — {themes[0]} (default) */',
        color_block(f':root,\n[data-theme="{themes[0]}"]', themes[0]), '']
for th in themes[1:]:
    out += [f'/* color — {th} */', color_block(f'[data-theme="{th}"]', th), '']

(HERE / 'tokens.css').write_text('\n'.join(out).rstrip() + '\n')
print('wrote tokens.css')
