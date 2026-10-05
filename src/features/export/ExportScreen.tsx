import Ionicons from '@expo/vector-icons/Ionicons';
import * as Sharing from 'expo-sharing';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomSheet, ChoiceChips, PillButton } from '@/components';
import { firstRecordedDay } from '@/db/user/export';
import { DayCalendar } from '@/features/log/DayCalendar';
import { useToday } from '@/features/log/useToday';
import { formatDate } from '@/i18n/dates';
import { addDays } from '@/lib/day';
import {
  EXPORT_FILES,
  EXPORT_RANGES,
  exportRange,
  type ExportFile,
  type ExportRange,
} from '@/lib/export';
import { useTheme } from '@/theme';

import { shareExportFile } from './share';

type Status = { file: ExportFile; state: 'busy' | 'failed' } | null;

/**
 * Export CSV (Profile → Export CSV, SPEC §5.14): pick the days, then share any of the four files
 * — every entry, daily totals, weight, water — through the phone's share sheet. One file at a
 * time: the share sheet takes one file.
 */
export function ExportScreen() {
  const { t } = useTranslation();
  const { colors, spacing, fontSize, radius, minTapTarget } = useTheme();
  const today = useToday();
  const [range, setRange] = useState<ExportRange>('month');
  const [custom, setCustom] = useState({ from: addDays(today, -6), to: today });
  const [picking, setPicking] = useState<'from' | 'to' | null>(null);
  const [firstDay, setFirstDay] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>(null);
  const [canShare, setCanShare] = useState(true);

  useEffect(() => {
    firstRecordedDay()
      .then(setFirstDay)
      .catch(() => {});
    Sharing.isAvailableAsync()
      .then(setCanShare)
      .catch(() => {});
  }, []);

  const { from, to } = exportRange(range, today, firstDay, custom);
  const caption = { color: colors.textSecondary, fontSize: fontSize.caption } as const;

  const share = async (file: ExportFile) => {
    setStatus({ file, state: 'busy' });
    try {
      await shareExportFile(t, file, from, to);
      setStatus(null);
    } catch {
      setStatus({ file, state: 'failed' });
    }
  };

  const dateRow = (which: 'from' | 'to') => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${t(`export.${which}`)}, ${formatDate(t, custom[which], today)}`}
      accessibilityHint={t('today.pickDayHint')}
      onPress={() => setPicking(which)}
      style={({ pressed }) => [
        styles.row,
        {
          minHeight: minTapTarget,
          paddingHorizontal: spacing.lg,
          gap: spacing.md,
          backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
          borderTopWidth: which === 'to' ? StyleSheet.hairlineWidth : 0,
          borderTopColor: colors.border,
        },
      ]}
    >
      <Text style={[styles.flex, { color: colors.text, fontSize: fontSize.body }]}>
        {t(`export.${which}`)}
      </Text>
      <Text style={{ color: colors.text, fontSize: fontSize.body }}>
        {formatDate(t, custom[which], today)}
      </Text>
      <Ionicons name="calendar-outline" size={20} color={colors.iconInactive} />
    </Pressable>
  );

  return (
    <SafeAreaView edges={['bottom']} style={[styles.flex, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        <Text style={{ color: colors.text, fontSize: fontSize.body }}>{t('export.intro')}</Text>

        <View style={{ gap: spacing.sm }}>
          <Text
            accessibilityRole="header"
            style={{ color: colors.text, fontSize: fontSize.body, fontWeight: '600' }}
          >
            {t('export.range')}
          </Text>
          <ChoiceChips
            label={t('export.range')}
            choices={EXPORT_RANGES.map((value) => ({
              value,
              label: t(`export.ranges.${value}`),
            }))}
            selected={range}
            onSelect={setRange}
          />
          {range === 'custom' ? (
            <View
              style={[
                styles.card,
                { borderColor: colors.border, borderRadius: radius.md, marginTop: spacing.xs },
              ]}
            >
              {dateRow('from')}
              {dateRow('to')}
            </View>
          ) : (
            <Text style={caption}>
              {t('export.rangeLine', {
                from: formatDate(t, from, today),
                to: formatDate(t, to, today),
              })}
            </Text>
          )}
        </View>

        <View style={{ gap: spacing.md }}>
          <Text
            accessibilityRole="header"
            style={{ color: colors.text, fontSize: fontSize.body, fontWeight: '600' }}
          >
            {t('export.filesTitle')}
          </Text>
          {!canShare && <Text style={caption}>{t('export.unavailable')}</Text>}
          {EXPORT_FILES.map((file) => {
            const name = t(`export.files.${file}.name`);
            const mine = status?.file === file ? status.state : null;
            return (
              <View
                key={file}
                style={[
                  styles.card,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderRadius: radius.md,
                    padding: spacing.lg,
                    gap: spacing.sm,
                  },
                ]}
              >
                <Text style={{ color: colors.text, fontSize: fontSize.body, fontWeight: '600' }}>
                  {name}
                </Text>
                <Text style={caption}>{t(`export.files.${file}.detail`)}</Text>
                <View style={[styles.row, { gap: spacing.md }]}>
                  <PillButton
                    icon="share-outline"
                    label={t('export.share')}
                    accessibilityLabel={t('export.shareLabel', { name })}
                    onPress={() => {
                      if (status?.state !== 'busy' && canShare) void share(file);
                    }}
                  />
                  {mine === 'busy' && (
                    <ActivityIndicator
                      color={colors.textSecondary}
                      accessibilityLabel={t('export.preparing')}
                    />
                  )}
                </View>
                {mine === 'failed' && (
                  <Text accessibilityLiveRegion="polite" style={caption}>
                    {t('export.problem')}
                  </Text>
                )}
              </View>
            );
          })}
          <Text style={caption}>{t('export.note')}</Text>
        </View>
      </ScrollView>

      {picking && (
        <BottomSheet
          title={t(picking === 'from' ? 'export.pickFrom' : 'export.pickTo')}
          onClose={() => setPicking(null)}
        >
          <DayCalendar
            day={custom[picking]}
            maxDate={today}
            onPick={(day) => {
              setCustom((current) => ({ ...current, [picking]: day }));
              setPicking(null);
            }}
          />
        </BottomSheet>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  card: { borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
});
