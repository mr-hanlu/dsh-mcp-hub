import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { h, setLocale, translate } from '../src/client/i18n.js';

test('English locale translates exact and dynamic messages', () => {
  setLocale('en');
  assert.equal(translate('已添加'), 'Added');
  assert.equal(translate('已添加 3 个服务'), 'Added 3 services');
  assert.equal(translate('已识别 2 个服务 · 待添加 1 · 无法解析 1'), 'Recognized 2 services · to add: 1 · unparseable: 1');
  assert.equal(translate('第 2/5 次重试'), 'Attempt 2/5');
  assert.equal(translate('无法解析此服务器配置：配置字段 env 必须是字符串键值对象'), 'Could not parse this server configuration: The env field must be an object of string values');
  assert.equal(translate('正在加载更多…'), 'Loading more…');
});

test('Chinese is kept and other locales fall back to English', () => {
  setLocale('zh');
  assert.equal(translate('已添加'), '已添加');
  setLocale('fr');
  assert.equal(translate('已添加'), 'Added');
  setLocale('zh-CN');
  assert.equal(translate('已添加'), '已添加');
});

test('h localizes React children and text props', () => {
  setLocale('en');
  const element = h('button', { title: '已添加', 'aria-label': '已添加' }, '已添加 2 个服务');
  assert.equal(element.props.title, 'Added');
  assert.equal(element.props['aria-label'], 'Added');
  assert.equal(element.props.children, 'Added 2 services');
});