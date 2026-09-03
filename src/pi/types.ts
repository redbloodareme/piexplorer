export interface PiProgress { iteration:number; totalIterations:number; elapsedMs:number }
export interface PiResult { digits:string; iterations:number; elapsedMs:number }
export interface PiEngine { calculate(decimalDigits:number, onProgress?:(p:PiProgress)=>void): PiResult }
export type WorkerRequest = {type:'start'; digits:number; updateEvery:number}|{type:'cancel'}
export type WorkerResponse = {type:'progress'; calculated:number; requested:number; iteration:number; totalIterations:number; elapsedMs:number}|{type:'chunk'; digits:string}|{type:'done'; iterations:number; elapsedMs:number}|{type:'error'; message:string}
