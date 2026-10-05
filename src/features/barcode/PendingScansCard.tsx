import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useBarcodeQueueStore, type QueuedBarcode } from '@/stores/barcodeQueue';
import { useTheme } from '@/theme';

/**
 * Pending lookups on Today (SPEC §2.2, §2.8): barcodes scanned while offline. Pending ones are
 * looked up again when the app opens or comes back to the front, or with *Try again now*. A found
 * one opens the product to log it (to the day and meal it was scanned for); one that wasn't found
 * opens the label form. ✕ takes a barcode off the list.
 */
export function PendingScansCard() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors, spacing, fontSize, radius, minTapTarget } = useTheme();
  const items = useBarcodeQueueStore((state) => state.items);
  const retrying = useBarcodeQueueStore((state) => state.retrying);
  const retry = useBarcodeQueueStore((state) => state.retry);
  const remove = useBarcodeQueueStore((state) => state.remove);
  if (items.length === 0) return null;

  const open = ({ row }: QueuedBarcode) => {
    const place = { day: row.day, ...(row.slotId ? { slot: row.slotId } : {}) };
    if (row.status === 'found' && row.customFoodId) {
      router.push({
        pathname: '/food/[id]',
        params: { id: row.customFoodId, source: 'custom', ...place },
      });
      void remove(row.barcode);
    } else if (row.status === 'not_found') {
      router.push({
        pathname: '/label',
        params: { barcode: row.barcode, reason: 'not_found', ...place },
      });
    }
  };

  const hasPending = items.some((item) => item.row.status === 'pending');

  return (
    <View
      testID="pending-scans"
      style={{
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: radius.md,
        paddingVertical: spacing.sm,
      }}
    >
      <View style={[styles.row, { paddingHorizontal: spacing.lg, gap: spacing.sm }]}>
        <Ionicons name="barcode-outline" size={20} color={colors.textSecondary} />
        <Text
          accessibilityRole="header"
          style={[styles.flex, { color: colors.text, fontSize: fontSize.body, fontWeight: '600' }]}
        >
          {t('pending.title')}
        </Text>
        {hasPending &&
          (retrying ? (
            <ActivityIndicator
              color={colors.textSecondary}
              accessibilityLabel={t('pending.trying')}
            />
          ) : (
            <Pressable
              accessibilityRole="button"
              onPress={() => void retry()}
              style={({ pressed }) => [
                styles.center,
                { minHeight: minTapTarget, opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <Text
                style={{
                  color: colors.text,
                  fontSize: fontSize.body,
                  textDecorationLine: 'underline',
                }}
              >
                {t('pending.retry')}
              </Text>
            </Pressable>
          ))}
      </View>

      {items.map((item) => {
        const { row } = item;
        const status =
          row.status === 'found'
            ? t('pending.found')
            : row.status === 'not_found'
              ? t('pending.notFound')
              : t('pending.waiting');
        return (
          <View key={row.barcode} style={[styles.row, { paddingLeft: spacing.lg }]}>
            <Pressable
              accessibilityRole={row.status === 'pending' ? 'text' : 'button'}
              disabled={row.status === 'pending'}
              onPress={() => open(item)}
              style={({ pressed }) => [
                styles.flex,
                {
                  minHeight: minTapTarget,
                  paddingVertical: spacing.sm,
                  opacity: pressed ? 0.6 : 1,
                },
              ]}
            >
              <Text style={{ color: colors.text, fontSize: fontSize.body }} numberOfLines={1}>
                {item.name ?? row.barcode}
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: fontSize.caption }}>
                {status}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('pending.remove', { code: row.barcode })}
              onPress={() => void remove(row.barcode)}
              style={[styles.center, { width: minTapTarget, height: minTapTarget }]}
            >
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  center: { alignItems: 'center', justifyContent: 'center' },
});
