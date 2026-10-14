import type { Lang } from './i18n';
import { I18N } from './i18n';
import type { Movement, Tool } from './types';

export const DAY_MS = 86_400_000;
export const DEFAULT_OVERDUE_DAYS = 30;

export function overdueDays(tool: Tool): number {
  if (tool.status !== 'taken' || !tool.takenAt) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(tool.takenAt).getTime()) / DAY_MS));
}
export const isOverdue = (tool: Tool, threshold: number) => overdueDays(tool) >= threshold;

export const toolMainName = (tool: Tool) => tool.products[0]?.desc ?? '';

export function toolMatches(tool: Tool, q: string): boolean {
  if (tool.toolCode.toLowerCase().includes(q)) return true;
  return tool.products.some((p) => p.pid.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q));
}

export function matchedProduct(tool: Tool, q: string) {
  if (!q) return undefined;
  return tool.products.find((p) => p.pid.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q));
}

export function locationLabel(tool: Tool, lang: Lang): string {
  const t = I18N[lang];
  if (tool.status === 'store') return t.inStore;
  if (tool.status === 'taken') return t.taken + (tool.takenNote ? `: ${tool.takenNote}` : '');
  const name = tool.machine?.name ?? '';
  return lang === 'si' ? `${name} මැෂිමේ` : `${t.onMachine} ${name}`;
}

export function movementText(m: Movement, lang: Lang): string {
  const t = I18N[lang];
  switch (m.action) {
    case 'assigned': return t.histToMachine(m.toMachine?.name ?? '');
    case 'returned': return t.histToStore;
    case 'taken_out': return t.histToTaken(m.note);
    case 'created': return t.histCreated;
    case 'edited': return t.histEdited;
    default: return '';
  }
}

export function movementDot(m: Movement): string {
  if (m.action === 'assigned') return 'machine';
  if (m.action === 'taken_out') return 'taken';
  return 'store';
}

export const formatTime = (iso: string, lang: Lang) =>
  new Date(iso).toLocaleString(lang === 'si' ? 'si-LK' : 'en-US', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
