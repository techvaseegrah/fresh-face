// src/app/(main)/telecalling/hooks/useTelecallingQueue.ts
'use client';

import { useState, useEffect, useCallback } from 'react';

// Define the shape of a client object
export interface TelecallingClient {
  customerId: string;
  searchableName: string;
  phoneNumber: string;
  lastVisitDate?: string;
  isCallback: boolean;
  lastServiceNames: string[];
  // ▼▼▼ NEW: Add the new fields ▼▼▼
  lastStylistName: string;
  lastBillAmount: number;
}

// Define the shape of the stats object
export interface TelecallingStats {
  totalCalls: number;
  appointmentsBooked: number;
  conversionRate: number;
}

export function useTelecallingQueue() {
  const [clients, setClients] = useState<TelecallingClient[]>([]);
  const [stats, setStats] = useState<TelecallingStats | null>(null); // State for stats
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // This function fetches BOTH the queue and the stats
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Fetch queue and stats in parallel for better performance
      const [queueResponse, statsResponse] = await Promise.all([
        fetch('/api/telecalling/queue'),
        fetch('/api/telecalling/stats'),
      ]);

      if (!queueResponse.ok) throw new Error('Failed to fetch the telecalling queue.');
      if (!statsResponse.ok) throw new Error('Failed to fetch telecalling stats.');

      const queueData: TelecallingClient[] = await queueResponse.json();
      const statsData: TelecallingStats = await statsResponse.json();
      
      setClients(queueData);
      setStats(statsData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch initial data when the hook is first used
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const currentClient = clients.length > 0 ? clients[0] : null;

  // This function logs an outcome, advances the queue, AND updates the stats
  const logAndProceed = useCallback(async (outcomeData: { outcome: string; notes?: string; callbackDate?: Date; appointmentId?: string; }) => {
    if (!currentClient) return;

    try {
      const response = await fetch('/api/telecalling/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: currentClient.customerId, ...outcomeData }),
      });

      if (!response.ok) throw new Error('Failed to log the outcome.');

      // On success, remove the client from the local state
      setClients(prevClients => prevClients.slice(1));

      // AND re-fetch the stats to update the dashboard in real-time
      const statsResponse = await fetch('/api/telecalling/stats');
      const statsData = await statsResponse.json();
      setStats(statsData);

    } catch (err: any) {
      setError(err.message);
    }
  }, [currentClient]);

  return {
    currentClient,
    stats, // Expose stats
    isLoading,
    error,
    logAndProceed,
    queueCount: clients.length,
  };
}