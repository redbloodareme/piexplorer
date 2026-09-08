import { calculateExpression } from '../god/MathEngine';
type Request = { type: 'calculate'; id: number; expression: string; precision: number };
type Response = { type: 'done'; id: number; value: string; elapsedMs: number; iterations: number } | { type: 'error'; id: number; message: string };
self.onmessage = (event: MessageEvent<Request>) => {
  const request = event.data;
  try {
    const result = calculateExpression(request.expression, request.precision);
    postMessage({ type: 'done', id: request.id, ...result, iterations: 1 } satisfies Response);
  } catch (error) {
    postMessage({ type: 'error', id: request.id, message: error instanceof Error ? error.message : 'Expression calculation failed.' } satisfies Response);
  }
};
