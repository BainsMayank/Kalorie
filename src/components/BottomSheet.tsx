import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';

type Props = {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Buttons that stay at the bottom while the content scrolls. */
  footer?: ReactNode;
};

/**
 * A panel that slides up from the bottom over a dimmed screen. It is shown while it is
 * rendered: open it with `{open && <BottomSheet … />}`, so it starts fresh every time.
 * Tapping the dimmed area, the ✕ or the phone's back button calls `onClose`.
 */
export function BottomSheet({ title, onClose, children, footer }: Props) {
  const { t } = useTranslation();
  const { colors, spacing, fontSize, radius, minTapTarget } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('sheet.close')}
          onPress={onClose}
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }]}
        />
        <View
          accessibilityViewIsModal
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              borderTopLeftRadius: radius.lg,
              borderTopRightRadius: radius.lg,
              paddingBottom: insets.bottom + spacing.md,
            },
          ]}
        >
          <View style={[styles.header, { paddingLeft: spacing.lg, paddingTop: spacing.sm }]}>
            <Text
              accessibilityRole="header"
              style={[
                styles.flex,
                { color: colors.text, fontSize: fontSize.title, fontWeight: '600' },
              ]}
              numberOfLines={2}
            >
              {title}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('sheet.close')}
              onPress={onClose}
              style={[styles.center, { width: minTapTarget, height: minTapTarget }]}
            >
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </Pressable>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md }}
          >
            {children}
          </ScrollView>
          {footer && <View style={{ paddingHorizontal: spacing.lg }}>{footer}</View>}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  sheet: { marginTop: 'auto', maxHeight: '92%' },
  header: { flexDirection: 'row', alignItems: 'center' },
});
