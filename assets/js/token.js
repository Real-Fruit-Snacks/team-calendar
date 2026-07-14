import { tokenCreateURL } from './host.js';

const KEY = 'tc_token';
const store = () => (typeof localStorage !== 'undefined' ? localStorage : null);

export function saveToken(t, storage = store()) { storage.setItem(KEY, t); }
export function loadToken(storage = store()) { return storage ? storage.getItem(KEY) : null; }
export function clearToken(storage = store()) { storage.removeItem(KEY); }
export function hasToken(storage = store()) { return !!loadToken(storage); }
export function createTokenURL(kind, origin) { return tokenCreateURL(kind, origin); }
