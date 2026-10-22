import type { RecoveryCodeStore, SaveRepository } from "@/application/ports";
import { generateRecoveryCode, migrate, normalizeRecoveryCode } from "@/domain/saveSchema";
import type { SaveData } from "@/domain/types";

const SAVE_KEY = "boba-story-save";
const CODE_KEY = "boba-story-device";

export class LocalStorageSaveRepository implements SaveRepository {
  load(): SaveData | null {
    try {
      const text = localStorage.getItem(SAVE_KEY);
      return text ? migrate(JSON.parse(text)) : null;
    } catch {
      return null;
    }
  }

  save(data: SaveData): boolean {
    try {
      data.updatedAt = Date.now();
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      return true;
    } catch {
      return false;
    }
  }

  clear() {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      /* storage unavailable */
    }
  }
}

const cryptoBytes = (n: number) => crypto.getRandomValues(new Uint8Array(n));

export class LocalStorageRecoveryCode implements RecoveryCodeStore {
  private memory: string | null = null;

  get(): string {
    try {
      const stored = normalizeRecoveryCode(localStorage.getItem(CODE_KEY) ?? "");
      if (stored) return stored;
      const code = generateRecoveryCode(cryptoBytes);
      localStorage.setItem(CODE_KEY, code);
      return code;
    } catch {
      return (this.memory ??= generateRecoveryCode(cryptoBytes));
    }
  }

  set(code: string) {
    const valid = normalizeRecoveryCode(code);
    if (!valid) return;
    this.memory = valid;
    try {
      localStorage.setItem(CODE_KEY, valid);
    } catch {
      /* storage unavailable */
    }
  }
}
