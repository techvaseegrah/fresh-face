'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react'; // 1. IMPORT useSession
import { toast } from 'react-toastify';

// Interfaces remain the same, they are well-defined.
export interface TelecallingClient {
  _id: string; // It's better to use _id from MongoDB for consistency
  searchableName: string;
  phoneNumber: string;
  lastVisitDate?: string;
  isCallback: boolean;
  lastServiceNames: string[];
  lastStylistName: string;
  lastBillAmount: number;
}
export interface TelecallingStats {
  totalCalls: number;
  appointmentsBooked: number;
  conversionRate: number;
}

export function useTelecallingQueue() {
  const { data: session } = useSession(); // 2. GET a session instance
  const [clients, setClients] = useState<TelecallingClient[]>([]);
  const [stats, setStats] = useState<TelecallingStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    // Don't fetch if the session isn't ready
    if (!session) return;

    setIsLoading(true);
    setError(null);
    try {
      const headers = { 'x-tenant-id': session.user.tenantId }; // 3. DEFINE headers for reuse

      const [queueResponse, statsResponse] = await Promise.all([
        fetch('/api/telecalling/queue', { headers }),
        fetch('/api/telecalling/stats', { headers }),
      ]);

      if (!queueResponse.ok) throw new Error('Failed to fetch the telecalling queue.');
      if (!statsResponse.ok) throw new Error('Failed to fetch telecalling stats.');

      const queueData = await queueResponse.json();
      const statsData = await statsResponse.json();
      
      setClients(queueData.queue || []); // Access the 'queue' property from your API response
      setStats(statsData);
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [session]); // 4. ADD session as a dependency

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const currentClient = clients.length > 0 ? clients[0] : null;

  const logAndProceed = useCallback(async (outcomeData: { outcome: string; [key: string]: any; }) => {
    if (!currentClient || !session) return;

    // --- REFINED ERROR HANDLING & LOGIC ---
    // Keep a reference to the client we are trying to log
    const clientToLog = currentClient;
    
    // Optimistically remove the client from the queue
    setClients(prevClients => prevClients.slice(1));

    try {
      const response = await fetch('/api/telecalling/log', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-tenant-id': session.user.tenantId, // Add tenant header
        },
        body: JSON.stringify({ customerId: clientToLog._id, ...outcomeData }),
      });

      if (!response.ok) {
        const errorBody = await response.json();
        throw new Error(errorBody.message || 'Failed to log the outcome.');
      }

      // On success, re-fetch the stats to update the dashboard
      const statsResponse = await fetch('/api/telecalling/stats', { headers: { 'x-tenant-id': session.user.tenantId } });
      const statsData = await statsResponse.json();
      setStats(statsData);
      
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
      setError(err.message);

      // **CRITICAL**: If the API call fails, add the client back to the front of the queue
      setClients(prevClients => [clientToLog, ...prevClients]);
    }
  }, [currentClient, session]); // Add session as a dependency

  return {
    currentClient,
    stats,
    isLoading,
    error,
    logAndProceed,
    queueCount: clients.length,
  };
}