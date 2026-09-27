import { useTranslation } from 'react-i18next';

import { PlaceholderScreen } from '@/components';

export function TodayScreen() {
  const { t } = useTranslation();
  return (
    <PlaceholderScreen
      title={t('tabs.today')}
      message={t('today.placeholder')}
      icon="sunny-outline"
    />
  );
}
