import React from 'react';
import { App } from './App.jsx';
import css from './style.css';

export const inject = ['slots'];
export function apply(ctx) {
  ctx.effect(() => {
    const style = document.createElement('style');
    style.textContent = css;
    document.head.append(style);
    return () => style.remove();
  });
  ctx.effect(() => ctx.slots.inject('settings.section', () => ctx.slots.register({ name: 'settings.section', id: 'dsh-mcp-hub', order: 36, label: () => 'MCP Hub' }, () => <App />)), 'MCP Hub settings');
}
