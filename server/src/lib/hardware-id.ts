/**
 * Hardware ID Generator - Native Module Version
 * Uses node-machine-id for desktop applications
 */

import { machineId } from 'node-machine-id';

let cachedMachineId: string | null = null;

/**
 * Generate a stable machine ID using native module
 */
export async function getHardwareId(): Promise<string> {
  if (cachedMachineId) {
    return cachedMachineId;
  }

  try {
    // Use the native node-machine-id module
    const id = await machineId();
    cachedMachineId = `NATIVE_${id}`;
    return cachedMachineId;
  } catch (error) {
    console.error('Failed to get native machine ID:', error);
    throw new Error('Machine ID is required for application to function');
  }
}

/**
 * Verify machine ID using native module
 */
export async function verifyMachineId(storedId: string): Promise<boolean> {
  const currentId = await getHardwareId();
  return storedId === currentId;
}

/**
 * Check if hardware has changed (always false for desktop)
 */
export async function checkHardwareChange(): Promise<boolean> {
  return false; // Desktop environments don't have hardware changes
}
