import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TextInput } from 'react-native';

import { BottomSheet, Button } from '@/components';
import { readTypedBarcode, type TypedBarcodeProblem } from '@/lib/barcode';
import { useTheme } from '@/theme';

/**
 * *Type the number* (SPEC §2.7): the digits printed under the bars. The check digit catches a
 * mistyped digit before anything is looked up.
 */
export function TypeCodeSheet({
  onClose,
  onCode,
}: {
  onClose: () => void;
  /** A barcode that reads right, in its one stored spelling. */
  onCode: (code: string) => void;
}) {
  const { t } = useTranslation();
  const { colors, spacing, fontSize, radius, minTapTarget } = useTheme();
  const [text, setText] = useState('');
  const [problem, setProblem] = useState<TypedBarcodeProblem | null>(null);

  const submit = () => {
    const result = readTypedBarcode(text);
    if (result.ok) onCode(result.code);
    else setProblem(result.problem);
  };

  return (
    <BottomSheet
      title={t('scan.typeTitle')}
      onClose={onClose}
      footer={<Button label={t('scan.lookUp')} onPress={submit} />}
    >
      <Text
        style={{ color: colors.textSecondary, fontSize: fontSize.body, marginBottom: spacing.md }}
      >
        {t('scan.typeHint')}
      </Text>
      <TextInput
        value={text}
        onChangeText={(next) => {
          setText(next);
          setProblem(null);
        }}
        onSubmitEditing={submit}
        accessibilityLabel={t('scan.typeLabel')}
        keyboardType="number-pad"
        returnKeyType="search"
        autoFocus
        maxLength={20}
        style={[
          styles.input,
          {
            minHeight: minTapTarget,
            borderRadius: radius.sm,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            color: colors.text,
            fontSize: fontSize.title,
            paddingHorizontal: spacing.md,
          },
        ]}
      />
      {problem && (
        <Text
          accessibilityLiveRegion="polite"
          style={{ color: colors.text, fontSize: fontSize.body, marginTop: spacing.sm }}
        >
          {t(`scan.problems.${problem}`)}
        </Text>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  input: { borderWidth: StyleSheet.hairlineWidth, letterSpacing: 2 },
});
