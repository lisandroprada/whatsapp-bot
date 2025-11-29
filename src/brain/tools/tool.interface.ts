import { FunctionDeclaration, SchemaType } from '@google/generative-ai';

export interface BrainTool {
  declaration: FunctionDeclaration;
  execute: (args: any, context?: any) => Promise<any>;
}
