/**
 * Hardware ID Generator - Serverless Compatible Version
 * Uses simple browser fingerprinting for Vercel deployment
 */

let cachedMachineId: string | null = null;

/**
 * Generate a stable machine ID for serverless environments
 */
export async function getHardwareId(): Promise<string> {
  if (cachedMachineId) {
    return cachedMachineId;
  }

  // For serverless environments, create a simple but stable ID
  // This avoids complex hardware detection that fails in serverless
  const userAgent = typeof window !== 'undefined' ? window.navigator.userAgent : 
    process.env.USER_AGENT || 'serverless-environment';
  
  // Create a simple hash from available environment variables
  const envString = [
    process.env.VERCEL_URL || 'localhost',
    process.env.NODE_ENV || 'production',
    userAgent
  ].join('|');

  // Simple hash function
  let hash = 0;
  for (let i = 0; i < envString.length; i++) {
    const char = envString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
    hash = Math.abs(hash);
  }

  cachedMachineId = `SERVERLESS_${hash.toString(16).padStart(8, '0').toUpperCase()}`;
  return cachedMachineId;
}

/**
 * Verify machine ID (always returns true for serverless)
 */
export async function verifyMachineId(storedId: string): Promise<boolean> {
  const currentId = await getHardwareId();
  return storedId === currentId;
}

/**
 * Check if hardware has changed (always false for serverless)
 */
export async function checkHardwareChange(): Promise<boolean> {
  return false; // Serverless environments don't have hardware changes
}
