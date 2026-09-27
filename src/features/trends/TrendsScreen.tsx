import { useTranslation } from 'react-i18next';

import { PlaceholderScreen } from '@/components';

export function TrendsScreen() {
  const { t } = useTranslation();
  return (
    <PlaceholderScreen
      title={t('tabs.trends')}
      message={t('trends.placeholder')}
      icon="stats-chart-outline"
    />
  );
}
