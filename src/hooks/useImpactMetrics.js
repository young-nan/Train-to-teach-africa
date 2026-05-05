/**
 * src/hooks/useImpactMetrics.js
 *
 * Public homepage impact counters. Reads from a public RPC that returns
 * cached aggregates — no auth required, fully cacheable on Cloudflare.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

async function fetchImpactMetrics() {
  const { data, error } = await supabase.rpc('public_impact_metrics');
  if (error) throw new Error(error.message);
  // Server returns: { schools, pupils, lessons, attendance_lift_pts }
  return {
    schools: data.schools,
    pupils: data.pupils,
    lessons: data.lessons,
    attendanceLiftPts: data.attendance_lift_pts,
  };
}

export function useImpactMetrics() {
  return useQuery({
    queryKey: ['public', 'impactMetrics'],
    queryFn: fetchImpactMetrics,
    staleTime: 5 * 60_000, // 5 min — counters don't need to be real-time
    retry: 1, // don't hammer the public endpoint on failure
  });
}
