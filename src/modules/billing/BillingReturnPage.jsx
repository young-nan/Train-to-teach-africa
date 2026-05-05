/**
 * src/modules/billing/BillingReturnPage.jsx
 *
 * Where Paystack redirects users after a successful or failed checkout.
 * We never trust this redirect alone — we poll the payments table until
 * the webhook has marked the payment verified.
 */

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { useAuth } from '@/hooks/useAuth';
import * as paymentService from '@/services/paymentService';
import { ROLE_HOME } from '@/config/roles';

export default function BillingReturnPage() {
  const [params] = useSearchParams();
  const reference = params.get('reference') || params.get('trxref');
  const { role } = useAuth();
  const navigate = useNavigate();

  const [state, setState] = useState({ phase: 'verifying', message: 'Confirming your payment…' });

  useEffect(() => {
    if (!reference) {
      setState({ phase: 'failed', message: 'Missing payment reference. If you were charged, please contact support.' });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const result = await paymentService.pollVerificationStatus(reference);
        if (cancelled) return;
        if (result.ok) {
          setState({ phase: 'success', message: 'Subscription active. Taking you in…' });
          setTimeout(() => navigate(ROLE_HOME[role] ?? '/'), 1200);
        } else if (result.pending) {
          setState({ phase: 'pending', message: 'Still confirming with the bank. Your access will activate as soon as it clears — usually a minute or two.' });
        } else {
          setState({ phase: 'failed', message: result.reason ?? 'Payment failed.' });
        }
      } catch (e) {
        setState({ phase: 'failed', message: 'Could not check payment status. Please try again or contact support.' });
      }
    })();
    return () => { cancelled = true; };
  }, [reference, navigate, role]);

  return (
    <div className="min-h-dvh bg-surface-1 grid place-items-center px-s-6">
      <Card className="max-w-[520px] w-full text-center">
        <div className="flex justify-center mb-s-4">
          {state.phase === 'verifying' && <Chip variant="gold" dot>Verifying</Chip>}
          {state.phase === 'success' && <Chip variant="green" dot>Verified</Chip>}
          {state.phase === 'pending' && <Chip variant="amber" dot>Pending</Chip>}
          {state.phase === 'failed' && <Chip variant="red" dot>Failed</Chip>}
        </div>
        <h1 className="font-display text-display-2 text-ink-0">
          {state.phase === 'success' ? 'You\'re in.' :
           state.phase === 'failed' ? 'Something went wrong.' :
           'One moment.'}
        </h1>
        <p className="mt-s-4 text-body text-ink-2">{state.message}</p>
        {state.phase !== 'verifying' && (
          <div className="mt-s-7">
            <Button intent="ghost" size="md" onClick={() => navigate(ROLE_HOME[role] ?? '/')}>
              Continue →
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
