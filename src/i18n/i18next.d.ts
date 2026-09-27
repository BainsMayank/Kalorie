import 'i18next';

import type en from './en.json';

// Lets TypeScript check translation keys, so a typo like t('tabs.todya') is caught.
declare module 'i18next' {
  interface CustomTypeOptions {
    resources: { translation: typeof en };
  }
}
