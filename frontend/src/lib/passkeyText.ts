import type { Lang } from './i18n';

export const passkeyText = (lang: Lang) => lang === 'si' ? {
  title: 'Passkey / Biometric login', login: 'Fingerprint / Face ID මඟින් පිවිසෙන්න',
  description: 'ඔබේ device එකේ fingerprint, Face ID හෝ PIN මඟින් පිවිසෙන්න. Biometric දත්ත server එකට යවන්නේ නැහැ.',
  https: 'Passkeys සඳහා trusted HTTPS address එකක් සහ සහාය දක්වන browser එකක් අවශ්‍යයි.',
  add: 'Passkey එකක් එක් කරන්න', name: 'Device නම', password: 'වර්තමාන password එක', remove: 'ඉවත් කරන්න',
  empty: 'තවම passkeys එක් කර නැහැ.', added: 'Passkey එක එක් කළා', removed: 'Passkey එක ඉවත් කළා',
  cancelled: 'Passkey request එක අවලංගු වුණා හෝ කාලය ඉකුත් වුණා.',
  roles: 'admin: සියලු කාර්යයන් සහ users • operator: tools add/edit/move • viewer: බලන්න පමණයි',
} : {
  title: 'Passkeys / Biometric login', login: 'Sign in with fingerprint / Face ID',
  description: 'Use your device fingerprint, Face ID or PIN. Biometric data stays on your device.',
  https: 'Passkeys need a trusted HTTPS address and a supported browser.',
  add: 'Add a passkey', name: 'Device name', password: 'Current password', remove: 'Remove',
  empty: 'No passkeys added yet.', added: 'Passkey added', removed: 'Passkey removed',
  cancelled: 'Passkey request was cancelled or timed out.',
  roles: 'admin: all actions and users • operator: add/edit/move tools • viewer: view only',
};

export function passkeyError(error: unknown, lang: Lang) {
  if (error instanceof Error && error.name === 'NotAllowedError') return passkeyText(lang).cancelled;
  return error instanceof Error ? error.message : passkeyText(lang).cancelled;
}
