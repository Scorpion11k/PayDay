import { SystemMode } from '@prisma/client';
import prisma from '../config/database';

const SINGLETON_ID = 'singleton';

class SystemSettingsService {
  private cachedMode: SystemMode | null = null;

  async getMode(): Promise<SystemMode> {
    if (this.cachedMode) {
      return this.cachedMode;
    }

    const settings = await prisma.systemSettings.findUnique({
      where: { id: SINGLETON_ID },
    });

    if (settings) {
      this.cachedMode = settings.mode;
      return settings.mode;
    }

    const created = await prisma.systemSettings.create({
      data: { id: SINGLETON_ID, mode: 'demo' },
    });
    this.cachedMode = created.mode;
    return created.mode;
  }

  async setMode(mode: SystemMode): Promise<SystemMode> {
    const settings = await prisma.systemSettings.upsert({
      where: { id: SINGLETON_ID },
      update: { mode },
      create: { id: SINGLETON_ID, mode },
    });

    this.cachedMode = settings.mode;
    console.log(`🔧 System mode changed to: ${mode}`);
    return settings.mode;
  }

  async getSettings() {
    const mode = await this.getMode();
    return { mode };
  }

  isDevelopmentMode(): boolean {
    return this.cachedMode === 'development';
  }

  clearCache() {
    this.cachedMode = null;
  }
}

export default new SystemSettingsService();
