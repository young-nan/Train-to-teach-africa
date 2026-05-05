/**
 * src/pages/public/NotFoundPage.jsx
 */

import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';

export default function NotFoundPage() {
  return (
    <div className="min-h-dvh bg-surface-1 text-ink-1 grid place-items-center px-s-6">
      <div className="max-w-[520px] text-center">
        <div className="font-mono text-eyebrow uppercase text-gold-400">404</div>
        <h1 className="mt-s-3 font-display text-display-1 text-ink-0">
          Not <span className="ital-gold">here.</span>
        </h1>
        <p className="mt-s-5 text-body-l text-ink-2">
          The page you were looking for has moved or doesn't exist.
        </p>
        <div className="mt-s-7">
          <Link to="/"><Button intent="primary" size="lg">Take me home</Button></Link>
        </div>
      </div>
    </div>
  );
}
