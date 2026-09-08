import { ChudnovskyEngine } from '../pi/Chudnovsky';
import type { WorkerRequest, WorkerResponse } from '../pi/types';

let cancelled = false;
const send = (message: WorkerResponse) => postMessage(message);

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  if (request.type === 'cancel') { cancelled = true; return; }
  cancelled = false;
  try {
    const result = new ChudnovskyEngine().calculate(request.digits, progress => {
      if (cancelled) throw new Error('Calculation stopped.');
      send({ type: 'progress', calculated: 0, requested: request.digits, iteration: progress.iteration, totalIterations: progress.totalIterations, elapsedMs: progress.elapsedMs });
    });
    for (let offset = 0; offset < result.digits.length; offset += request.updateEvery) {
      if (cancelled) return;
      send({ type: 'chunk', digits: result.digits.slice(offset, offset + request.updateEvery) });
    }
    if (!cancelled) send({ type: 'done', iterations: result.iterations, elapsedMs: result.elapsedMs });
  } catch (error) {
    send({ type: 'error', message: error instanceof Error ? error.message : 'Pi calculation failed unexpectedly.' });
  }
};

self.onmessageerror = () => send({ type: 'error', message: 'The calculation worker received an invalid message.' });
self.onerror = () => send({ type: 'error', message: 'The calculation worker encountered an unexpected error.' });
