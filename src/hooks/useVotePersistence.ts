import { useState, useEffect, useCallback } from 'react';

export interface VoteRecord {
  id: string;
  voterName: string;
  vote: 'approve' | 'reject' | 'suggest_change';
  suggestion?: string;
  timestamp: number;
}

const STORAGE_KEY_PREFIX = 'votes_';

function getStorageKey(planId: string): string {
  return `${STORAGE_KEY_PREFIX}${planId}`;
}

export function useVotePersistence(planId: string) {
  const [votes, setVotes] = useState<VoteRecord[]>(() => {
    if (typeof window === 'undefined') return [];

    try {
      const stored = localStorage.getItem(getStorageKey(planId));
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(getStorageKey(planId), JSON.stringify(votes));
    } catch (err) {
      console.warn('[VotePersistence] Failed to save to localStorage:', err);
    }
  }, [planId, votes]);

  const addVote = useCallback((vote: VoteRecord) => {
    setVotes((prev) => {
      const existingIndex = prev.findIndex((v) => v.voterName === vote.voterName);

      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = vote;
        return updated;
      }

      return [...prev, vote];
    });
  }, []);

  const removeVote = useCallback((voterName: string) => {
    setVotes((prev) => prev.filter((v) => v.voterName !== voterName));
  }, []);

  const clearVotes = useCallback(() => {
    setVotes([]);
  }, []);

  const getVoteByVoter = useCallback(
    (voterName: string): VoteRecord | undefined => {
      return votes.find((v) => v.voterName === voterName);
    },
    [votes]
  );

  const hasVoted = useCallback(
    (voterName: string): boolean => {
      return votes.some((v) => v.voterName === voterName);
    },
    [votes]
  );

  const syncWithServer = useCallback(
    (serverVotes: VoteRecord[]) => {
      const merged = new Map<string, VoteRecord>();

      for (const vote of serverVotes) {
        merged.set(vote.voterName, vote);
      }

      for (const vote of votes) {
        const serverVote = merged.get(vote.voterName);
        if (!serverVote || vote.timestamp > serverVote.timestamp) {
          merged.set(vote.voterName, vote);
        }
      }

      setVotes(Array.from(merged.values()));
    },
    [votes]
  );

  const exportVotes = useCallback((): string => {
    return JSON.stringify(votes, null, 2);
  }, [votes]);

  const importVotes = useCallback((jsonString: string): boolean => {
    try {
      const imported = JSON.parse(jsonString) as VoteRecord[];
      if (!Array.isArray(imported)) return false;

      setVotes(imported);
      return true;
    } catch {
      return false;
    }
  }, []);

  return {
    votes,
    addVote,
    removeVote,
    clearVotes,
    getVoteByVoter,
    hasVoted,
    syncWithServer,
    exportVotes,
    importVotes,
  };
}
