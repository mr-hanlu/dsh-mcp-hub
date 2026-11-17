import React from 'react';
import { App, HubIcon } from './App.jsx';
import { setLocale } from './i18n.js';
import css from './style.css';


export const inject = ['slots', 'locale'];
export function apply(ctx) {
  setLocale(ctx.locale.getSnapshot().active);
  ctx.effect(() => ctx.locale.subscribe(() => setLocale(ctx.locale.getSnapshot().active)), 'MCP Hub locale');
  ctx.effect(() => {
    const style = document.createElement('style');
    style.textContent = css;
    document.head.append(style);
    return () => style.remove();
  });
  ctx.effect(() => ctx.slots.inject('settings.section', () => ctx.slots.register({ name: 'settings.section', id: 'dsh-mcp-hub', order: 36, label: () => 'MCP Hub' }, () => <App locale={ctx.locale} />)), 'MCP Hub settings');
  ctx.effect(() => ctx.slots.inject('settings.section.icon', () => ctx.slots.register({ name: 'settings.section.icon', id: 'dsh-mcp-hub', order: 36 }, (props) => <HubIcon {...props} />)), 'MCP Hub sidebar icon');
}
