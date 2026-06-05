import type { ToolName } from './tools';

export interface ToolCall {
  id: string;
  tool: ToolName;
  dependsOn?: string[];
  input: Record<string, unknown>;
}

export interface ToolResult {
  id: string;
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface DependencyGraph {
  nodes: Map<string, Set<string>>;
  reverseNodes: Map<string, Set<string>>;
}

export interface ExecutionLevel {
  level: number;
  calls: string[];
}

export function buildDependencyGraph(calls: ToolCall[]): DependencyGraph {
  const nodes = new Map<string, Set<string>>();
  const reverseNodes = new Map<string, Set<string>>();

  for (const call of calls) {
    if (!nodes.has(call.id)) {
      nodes.set(call.id, new Set());
    }

    if (!reverseNodes.has(call.id)) {
      reverseNodes.set(call.id, new Set());
    }

    if (call.dependsOn && call.dependsOn.length > 0) {
      for (const depId of call.dependsOn) {
        nodes.get(call.id)!.add(depId);

        if (!reverseNodes.has(depId)) {
          reverseNodes.set(depId, new Set());
        }
        reverseNodes.get(depId)!.add(call.id);
      }
    }
  }

  return { nodes, reverseNodes };
}

export function topologicalSort(graph: DependencyGraph): ExecutionLevel[] {
  const levels: ExecutionLevel[] = [];
  const visited = new Set<string>();
  const inDegree = new Map<string, number>();

  for (const [nodeId, deps] of graph.nodes) {
    inDegree.set(nodeId, deps.size);
  }

  let level = 0;
  let currentLevel = Array.from(inDegree.entries())
    .filter(([, degree]) => degree === 0)
    .map(([id]) => id);

  while (currentLevel.length > 0) {
    levels.push({ level, calls: currentLevel });

    for (const nodeId of currentLevel) {
      visited.add(nodeId);

      const dependents = graph.reverseNodes.get(nodeId) || new Set();
      for (const dependentId of dependents) {
        if (!visited.has(dependentId)) {
          const currentDegree = inDegree.get(dependentId) || 0;
          inDegree.set(dependentId, currentDegree - 1);
        }
      }
    }

    level++;
    currentLevel = Array.from(inDegree.entries())
      .filter(([id, degree]) => !visited.has(id) && degree <= 0)
      .map(([id]) => id);
  }

  const unvisited = Array.from(graph.nodes.keys()).filter((id) => !visited.has(id));
  if (unvisited.length > 0) {
    console.warn('[DependencyGraph] Circular dependency detected for:', unvisited);
    for (const id of unvisited) {
      levels.push({ level: level++, calls: [id] });
    }
  }

  return levels;
}

export function detectCircularDependencies(graph: DependencyGraph): string[] | null {
  const visited = new Set<string>();
  const recStack = new Set<string>();
  const cycleNodes: string[] = [];

  function dfs(nodeId: string): boolean {
    visited.add(nodeId);
    recStack.add(nodeId);

    const neighbors = graph.reverseNodes.get(nodeId) || new Set();
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (dfs(neighbor)) {
          if (cycleNodes.length === 0 || cycleNodes[cycleNodes.length - 1] !== nodeId) {
            cycleNodes.push(neighbor);
          }
          return true;
        }
      } else if (recStack.has(neighbor)) {
        cycleNodes.push(neighbor);
        return true;
      }
    }

    recStack.delete(nodeId);
    return false;
  }

  for (const nodeId of graph.nodes.keys()) {
    if (!visited.has(nodeId)) {
      if (dfs(nodeId)) {
        return cycleNodes;
      }
    }
  }

  return null;
}

export async function executeWithDependencyGraph<T extends ToolCall>(
  graph: DependencyGraph,
  calls: T[],
  executor: (call: T) => Promise<ToolResult>
): Promise<ToolResult[]> {
  const circularDeps = detectCircularDependencies(graph);
  if (circularDeps) {
    throw new Error(`Circular dependency detected: ${circularDeps.join(' -> ')}`);
  }

  const levels = topologicalSort(graph);
  const results = new Map<string, ToolResult>();
  const callMap = new Map(calls.map((c) => [c.id, c]));

  for (const { level, calls: levelCalls } of levels) {
    console.log(`[DependencyGraph] Executing level ${level}:`, levelCalls);

    const batchResults = await Promise.all(
      levelCalls.map(async (callId) => {
        const call = callMap.get(callId);
        if (!call) {
          return { id: callId, success: false, error: 'Call not found' } as ToolResult;
        }

        try {
          const result = await executor(call);
          results.set(callId, result);
          return result;
        } catch (err) {
          const errorResult = {
            id: callId,
            success: false,
            error: err instanceof Error ? err.message : 'Unknown error',
          } as ToolResult;
          results.set(callId, errorResult);
          return errorResult;
        }
      })
    );

    console.log(`[DependencyGraph] Level ${level} completed:`, batchResults);
  }

  return calls.map((c) => results.get(c.id)!);
}

export function estimateParallelizationGain(levels: ExecutionLevel[]): number {
  if (levels.length === 0) return 1;

  const totalCalls = levels.reduce((sum, l) => sum + l.calls.length, 0);
  const maxConcurrent = Math.max(...levels.map((l) => l.calls.length));

  return totalCalls / (levels.length * maxConcurrent);
}

export function visualizeGraph(graph: DependencyGraph): string {
  const lines: string[] = ['digraph {'];

  for (const [nodeId, deps] of graph.nodes) {
    if (deps.size > 0) {
      for (const depId of deps) {
        lines.push(`  "${depId}" -> "${nodeId}"`);
      }
    } else {
      lines.push(`  "${nodeId}"`);
    }
  }

  lines.push('}');
  return lines.join('\n');
}
