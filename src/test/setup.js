import '@testing-library/jest-dom';

// Stub a minimal env for unit tests so importing config files doesn't crash.
import.meta.env.VITE_FX_NGN_PER_USD = '1370.26';
import.meta.env.VITE_FX_BENCHMARK_DATE = '2026-05-05';
