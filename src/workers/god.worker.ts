import { calculateExpression } from '../god/MathEngine';
type Request = { type: 'calculate'; expression: string; precision: number };
type Response = { type: 'done'; value: string; elapsedMs: number } | { type: 'error'; message: string };
self.onmessage = (event: MessageEvent<Request>) => { try { const result = calculateExpression(event.data.expression, event.data.precision); postMessage({ type: 'done', ...result } satisfies Response); } catch (error) { postMessage({ type: 'error', message: error instanceof Error ? error.message : 'Expression calculation failed.' } satisfies Response); } };
