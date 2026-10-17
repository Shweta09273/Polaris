/**
 * Knowledge Graph service — ports and scaffolding only in Milestone 1.
 * No synthetic edges.
 */

export interface KnowledgeGraphPort {
  upsertNode(input: {
    id: string;
    labels: string[];
    properties: Record<string, unknown>;
  }): Promise<void>;
  upsertEdge(input: {
    id: string;
    type: string;
    fromId: string;
    toId: string;
    properties?: Record<string, unknown>;
  }): Promise<void>;
  neighborhood(assetId: string, depth: number): Promise<{ nodes: unknown[]; edges: unknown[] }>;
}

export class NotConfiguredKnowledgeGraph implements KnowledgeGraphPort {
  async upsertNode(): Promise<void> {
    throw new Error("Knowledge graph adapter not configured. Connect Neo4j in Milestone 3.");
  }

  async upsertEdge(): Promise<void> {
    throw new Error("Knowledge graph adapter not configured. Connect Neo4j in Milestone 3.");
  }

  async neighborhood(): Promise<{ nodes: unknown[]; edges: unknown[] }> {
    throw new Error("Knowledge graph adapter not configured. Connect Neo4j in Milestone 3.");
  }
}
