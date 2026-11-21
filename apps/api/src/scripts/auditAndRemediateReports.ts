/**
 * Re-export historical audit and remediation functions and interfaces
 * for backward compatibility with existing callers.
 */
export * from './auditAndRemediateHistoricalData';
import { main } from './auditAndRemediateHistoricalData';

if (require.main === module) {
  main().catch((err) => {
    console.error('Audit failed:', err);
    process.exit(1);
  });
}
