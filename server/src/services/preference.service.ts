import { NotificationChannel, TemplateLanguage, TemplateTone } from '@prisma/client';

/**
 * Preference Service
 * Provides automatic preference assignment based on customer attributes
 */

/**
 * Calculate age from birth date
 */
function calculateAge(birthDate: Date): number {
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

/**
 * Recommend communication channel based on customer age
 * 
 * Logic:
 * - Under 25: WhatsApp (youth prefer messaging apps)
 * - 25-39: SMS (working age prefer SMS)
 * - 40-59: Email (middle age prefer email)
 * - 60+: Email (seniors prefer email - easier to read)
 * - Unknown: Email (default)
 */
export function recommendChannelByAge(birthDate: Date | string | null): NotificationChannel {
  if (!birthDate) return 'email'; // Default

  const date = typeof birthDate === 'string' ? new Date(birthDate) : birthDate;
  
  if (isNaN(date.getTime())) return 'email'; // Invalid date
  
  const age = calculateAge(date);

  if (age < 25) return 'whatsapp';    // Youth prefer messaging apps
  if (age < 40) return 'sms';          // Working age prefer SMS
  if (age < 60) return 'email';        // Middle age prefer email
  return 'email';                       // Seniors prefer email (easier to read)
}

/**
 * Recommend language based on customer region
 * 
 * Logic:
 * - Regions containing 'arab', 'jaffa' -> Arabic
 * - Regions containing 'israel', 'tel aviv', 'jerusalem' -> Hebrew
 * - Other/Unknown -> Hebrew (default for Israeli market)
 */
export function recommendLanguageByRegion(region: string | null): TemplateLanguage {
  if (!region) return 'he'; // Default to Hebrew

  const regionLower = region.toLowerCase();

  // Arabic-speaking regions
  if (regionLower.includes('arab') || regionLower.includes('jaffa')) {
    return 'ar';
  }

  // Hebrew-speaking regions (or default for Israeli regions)
  if (
    regionLower.includes('israel') ||
    regionLower.includes('tel aviv') ||
    regionLower.includes('jerusalem') ||
    regionLower.includes('haifa') ||
    regionLower.includes('beer sheva') ||
    regionLower.includes('netanya') ||
    regionLower.includes('herzliya') ||
    regionLower.includes('ramat gan') ||
    regionLower.includes('petah tikva') ||
    regionLower.includes('rishon') ||
    regionLower.includes('ashdod') ||
    regionLower.includes('ashkelon')
  ) {
    return 'he';
  }

  // Default to Hebrew for Israeli market
  return 'he';
}

/**
 * Get default tone based on customer status/segment
 * For now, default to 'calm' for new customers
 */
export function getDefaultTone(): TemplateTone {
  return 'calm';
}

/**
 * Resolve customer preferences, applying auto-logic when not explicitly set
 */
export function resolvePreferences(
  customer: {
    dateOfBirth?: Date | string | null;
    region?: string | null;
    preferredChannel?: NotificationChannel | null;
    preferredLanguage?: TemplateLanguage | null;
    preferredTone?: TemplateTone | null;
  }
): {
  preferredChannel: NotificationChannel;
  preferredLanguage: TemplateLanguage;
  preferredTone: TemplateTone;
} {
  return {
    preferredChannel: customer.preferredChannel || recommendChannelByAge(customer.dateOfBirth || null),
    preferredLanguage: customer.preferredLanguage || recommendLanguageByRegion(customer.region || null),
    preferredTone: customer.preferredTone || getDefaultTone(),
  };
}

/**
 * Check if a customer is eligible for a specific channel
 */
export function isEligibleForChannel(
  customer: { email?: string | null; phone?: string | null },
  channel: NotificationChannel
): boolean {
  switch (channel) {
    case 'email':
      return !!customer.email && customer.email.trim().length > 0;
    case 'sms':
    case 'whatsapp':
    case 'call_task':
      return !!customer.phone && customer.phone.trim().length > 0;
    default:
      return false;
  }
}

/**
 * Get channel label for display
 */
export function getChannelLabel(channel: NotificationChannel): string {
  const labels: Record<NotificationChannel, string> = {
    email: 'Email',
    sms: 'SMS',
    whatsapp: 'WhatsApp',
    call_task: 'Voice Call',
  };
  return labels[channel] || channel;
}

/**
 * Get language label for display
 */
export function getLanguageLabel(language: TemplateLanguage): string {
  const labels: Record<TemplateLanguage, string> = {
    en: 'English',
    he: 'עברית',
    ar: 'العربية',
  };
  return labels[language] || language;
}

/**
 * Get tone label for display
 */
export function getToneLabel(tone: TemplateTone): string {
  const labels: Record<TemplateTone, string> = {
    calm: 'Calm',
    medium: 'Medium',
    heavy: 'Heavy',
  };
  return labels[tone] || tone;
}

export default {
  recommendChannelByAge,
  recommendLanguageByRegion,
  getDefaultTone,
  resolvePreferences,
  isEligibleForChannel,
  getChannelLabel,
  getLanguageLabel,
  getToneLabel,
};
