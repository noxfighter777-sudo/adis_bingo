// @ts-nocheck
import { FIXED_CARTELAS } from "./fixed-cartelas";
import { storage } from "../../storage/prisma-storage";

// Convert hardcoded cartela to unified format
function convertHardcodedCartela(hardcodedCartela: any): {
  pattern: number[][];
  numbers: number[];
  name: string;
} {
  const pattern: number[][] = [];
  const numbers: number[] = [];

  // Convert B-I-N-G-O format to 5x5 pattern and flat numbers array
  const columns = ['B', 'I', 'N', 'G', 'O'];

  for (let row = 0; row < 5; row++) {
    const currentRow: number[] = [];
    for (let col = 0; col < 5; col++) {
      const value = hardcodedCartela[columns[col]][row];
      if (value === "FREE") {
        currentRow.push(0); // Use 0 to represent FREE
        numbers.push(0);
      } else {
        currentRow.push(value);
        numbers.push(value);
      }
    }
    pattern.push(currentRow);
  }

  return {
    pattern,
    numbers,
    name: `Cartela ${hardcodedCartela.Board}`
  };
}

// Load hardcoded cartelas into database
export async function loadHardcodedCartelas(adminId: number): Promise<void> {
  console.log("Loading hardcoded cartelas...");

  for (const hardcodedCartela of FIXED_CARTELAS) {
    const cartelaNumber = hardcodedCartela.Board;

    // Check if cartela already exists
    const existing = await storage.getCartelaByNumber(adminId, cartelaNumber);

    const converted = convertHardcodedCartela(hardcodedCartela);

    if (!existing) {
      // Insert new hardcoded cartela using Prisma
      await storage.prisma.cartela.create({
        data: {
          employeeId: adminId,
          cartelaNumber,
          cardNo: cartelaNumber,
          name: converted.name,
          pattern: JSON.stringify(converted.pattern),
          isHardcoded: true,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      });

      console.log(`Loaded hardcoded cartela ${cartelaNumber}`);
    } else {
      // Update existing cartela if adding same cartela number
      await storage.prisma.cartela.update({
        where: { id: existing.id },
        data: {
          pattern: JSON.stringify(converted.pattern),
          name: converted.name,
          isHardcoded: true,
          updatedAt: new Date(),
        }
      });

      console.log(`Updated existing cartela ${cartelaNumber} with default values`);
    }
  }

  console.log("Finished loading hardcoded cartelas");
}

// Ensure all employees have hardcoded cartelas loaded
export async function ensureHardcodedCartelasLoaded(): Promise<void> {
  console.log("Loading hardcoded cartelas for all employees...");

  try {
    const allEmployees = await storage.prisma.user.findMany({
      where: { role: 'employee' }
    });

    for (const employee of allEmployees) {
      await loadHardcodedCartelas(employee.id);
    }

    console.log("Finished loading hardcoded cartelas for all employees");
  } catch (error) {
    console.error("Error loading hardcoded cartelas:", error);
  }
}