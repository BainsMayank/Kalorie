import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, ChoiceChips, NumberField } from '@/components';
import { saveProduct } from '@/db/user/customFoods';
import {
  LABEL_FIELDS,
  labelToPer100g,
  productUnits,
  type LabelBasis,
  type LabelField,
} from '@/lib/label';
import { NUTRIENTS } from '@/lib/nutrients';
import { parseAmount } from '@/lib/parse';
import { useBarcodeQueueStore } from '@/stores/barcodeQueue';
import { useTheme } from '@/theme';

import { keepLabelPhoto } from './labelPhoto';

type Per = LabelBasis['per'];
const PER_OPTIONS: readonly Per[] = ['100g', '100ml', 'serving'];

/** The label fields two to a row, the way a label lists them. */
const ROWS: readonly (readonly [LabelField, LabelField])[] = [
  ['energy_kcal', 'protein_g'],
  ['carb_g', 'sugar_g'],
  ['fat_g', 'sat_fat_g'],
  ['trans_fat_g', 'fibre_g'],
  ['sodium_mg', 'cholesterol_mg'],
];

const unitOf = (field: LabelField) => NUTRIENTS.find((n) => n.key === field)!.unit;

type Problem = 'name' | 'kcal' | 'serving';

/**
 * Add from label (SPEC §2.8), for a packet Open Food Facts doesn't know: name, brand, the values
 * from the label per 100 g, per 100 ml or per serving (Indian labels show both), an optional photo
 * of the label. Saved per 100 g as a product with its barcode, so the next scan finds it at once.
 * Params: `barcode`; `reason` (`not_found`, `no_nutrition`, `offline`); `name` and `brand` known
 * from Open Food Facts; `slot` and `day` to pass on to the product for logging.
 */
export function LabelFormScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors, spacing, fontSize, radius } = useTheme();
  const params = useLocalSearchParams<{
    barcode: string;
    reason?: string;
    name?: string;
    brand?: string;
    slot?: string;
    day?: string;
  }>();
  const removeQueued = useBarcodeQueueStore((state) => state.remove);

  const [name, setName] = useState(params.name ?? '');
  const [brand, setBrand] = useState(params.brand ?? '');
  const [per, setPer] = useState<Per>('100g');
  const [serving, setServing] = useState('');
  const [pack, setPack] = useState('');
  const [values, setValues] = useState<Record<LabelField, string>>(
    () => Object.fromEntries(LABEL_FIELDS.map((f) => [f, ''])) as Record<LabelField, string>,
  );
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoNote, setPhotoNote] = useState<string | null>(null);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  const servingG = parseAmount(serving);
  const packG = parseAmount(pack);

  const takePhoto = async () => {
    setPhotoNote(null);
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setPhotoNote(t('label.cameraBlocked'));
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.6 });
    if (!result.canceled) setPhoto(result.assets[0].uri);
  };
  const choosePhoto = async () => {
    setPhotoNote(null);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.6,
    });
    if (!result.canceled) setPhoto(result.assets[0].uri);
  };

  const save = async () => {
    const basis: LabelBasis =
      per === 'serving'
        ? { per, servingG: servingG ?? 0 }
        : per === '100ml'
          ? { per, densityGPerMl: 1 }
          : { per };
    const typed = Object.fromEntries(LABEL_FIELDS.map((f) => [f, parseAmount(values[f])]));
    const found: Problem[] = [];
    if (name.trim() === '') found.push('name');
    if (typed.energy_kcal === null) found.push('kcal');
    if (per === 'serving' && !(servingG && servingG > 0)) found.push('serving');
    setProblems(found);
    const nutrients = labelToPer100g(typed, basis);
    if (found.length > 0 || nutrients === null) return;

    setSaving(true);
    setFailed(false);
    try {
      const labelPhotoUri = photo ? await keepLabelPhoto(photo) : null;
      const units = productUnits({
        servingG: servingG && servingG > 0 ? servingG : null,
        packG: packG && packG > 0 ? packG : null,
        isLiquid: per === '100ml',
      }).map((u) => ({ ...u, label: t(`units.${u.unit}`) }));
      const id = await saveProduct({
        barcode: params.barcode,
        name: name.trim(),
        brand: brand.trim() || null,
        servingG: servingG && servingG > 0 ? servingG : null,
        densityGPerMl: 1,
        offStatus: 'user_added',
        offFetchedAt: null,
        labelPhotoUri,
        nutrients,
        units,
      });
      await removeQueued(params.barcode);
      router.replace({
        pathname: '/food/[id]',
        params: {
          id,
          source: 'custom',
          ...(params.slot ? { slot: params.slot } : {}),
          ...(params.day ? { day: params.day } : {}),
        },
      });
    } catch {
      setFailed(true);
      setSaving(false);
    }
  };

  const intro =
    params.reason === 'not_found'
      ? t('label.notFound')
      : params.reason === 'no_nutrition'
        ? t('label.noNutrition')
        : null;
  const problemText = (problem: Problem) =>
    problems.includes(problem) ? (
      <Text style={{ color: colors.text, fontSize: fontSize.caption, marginTop: spacing.xs }}>
        {t(
          problem === 'name'
            ? 'label.nameRequired'
            : problem === 'kcal'
              ? 'label.kcalRequired'
              : 'label.servingRequired',
        )}
      </Text>
    ) : null;
  const heading = (text: string) => (
    <Text
      accessibilityRole="header"
      style={{
        color: colors.textSecondary,
        fontSize: fontSize.caption,
        fontWeight: '600',
        textTransform: 'uppercase',
        marginTop: spacing.xl,
        marginBottom: spacing.sm,
      }}
    >
      {text}
    </Text>
  );
  const textBox = {
    minHeight: 48,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: fontSize.body,
    paddingHorizontal: spacing.md,
  };

  return (
    <SafeAreaView edges={['bottom']} style={[styles.flex, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}
        keyboardShouldPersistTaps="handled"
      >
        {intro && (
          <Text style={{ color: colors.text, fontSize: fontSize.body, marginBottom: spacing.sm }}>
            {intro}
          </Text>
        )}
        <Text style={{ color: colors.textSecondary, fontSize: fontSize.caption }}>
          {t('label.barcode', { code: params.barcode })}
        </Text>

        {/* Name and brand */}
        <Text
          style={{
            color: colors.textSecondary,
            fontSize: fontSize.caption,
            marginTop: spacing.lg,
            marginBottom: spacing.xs,
          }}
        >
          {t('label.name')}
        </Text>
        <TextInput
          value={name}
          onChangeText={setName}
          accessibilityLabel={t('label.name')}
          placeholder={t('label.namePlaceholder')}
          placeholderTextColor={colors.iconInactive}
          style={textBox}
        />
        {problemText('name')}
        <Text
          style={{
            color: colors.textSecondary,
            fontSize: fontSize.caption,
            marginTop: spacing.md,
            marginBottom: spacing.xs,
          }}
        >
          {t('label.brand')}
        </Text>
        <TextInput
          value={brand}
          onChangeText={setBrand}
          accessibilityLabel={t('label.brand')}
          placeholderTextColor={colors.iconInactive}
          style={textBox}
        />

        {/* What the numbers are for */}
        {heading(t('label.per'))}
        <ChoiceChips
          label={t('label.per')}
          choices={PER_OPTIONS.map((value) => ({ value, label: t(`label.perOptions.${value}`) }))}
          selected={per}
          onSelect={setPer}
        />
        <Text
          style={{ color: colors.textSecondary, fontSize: fontSize.caption, marginTop: spacing.sm }}
        >
          {t('label.perHint')}
        </Text>
        <View style={[styles.row, { gap: spacing.md, marginTop: spacing.md }]}>
          <NumberField
            label={per === 'serving' ? t('label.servingSize') : t('label.servingSizeOptional')}
            value={serving}
            onChangeText={setServing}
            unit={t('nutrientUnits.g')}
          />
          <NumberField
            label={t('label.packSize')}
            value={pack}
            onChangeText={setPack}
            unit={t('nutrientUnits.g')}
          />
        </View>
        {problemText('serving')}

        {/* The numbers */}
        {heading(t('label.values'))}
        <View style={{ gap: spacing.md }}>
          {ROWS.map((row) => (
            <View key={row[0]} style={[styles.row, { gap: spacing.md }]}>
              {row.map((field) => (
                <NumberField
                  key={field}
                  label={t(`label.fields.${field}`)}
                  value={values[field]}
                  onChangeText={(text) => setValues((v) => ({ ...v, [field]: text }))}
                  unit={t(`nutrientUnits.${unitOf(field)}`)}
                  placeholder={field === 'energy_kcal' ? undefined : t('label.optional')}
                  testID={`label-${field}`}
                />
              ))}
            </View>
          ))}
        </View>
        {problemText('kcal')}

        {/* Photo of the label */}
        {heading(t('label.photo'))}
        {photo ? (
          <View>
            <Image
              source={{ uri: photo }}
              accessibilityLabel={t('label.photoAlt')}
              resizeMode="contain"
              style={{ height: 180, borderRadius: radius.md, backgroundColor: colors.surfaceMuted }}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('label.removePhoto')}
              onPress={() => setPhoto(null)}
              style={[styles.row, { minHeight: 48, gap: spacing.xs, alignSelf: 'flex-start' }]}
            >
              <Ionicons name="close" size={18} color={colors.textSecondary} />
              <Text style={{ color: colors.textSecondary, fontSize: fontSize.body }}>
                {t('label.removePhoto')}
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={[styles.row, { gap: spacing.md }]}>
            <View style={styles.flex}>
              <Button
                kind="secondary"
                label={t('label.takePhoto')}
                onPress={() => void takePhoto()}
              />
            </View>
            <View style={styles.flex}>
              <Button
                kind="secondary"
                label={t('label.choosePhoto')}
                onPress={() => void choosePhoto()}
              />
            </View>
          </View>
        )}
        {photoNote && (
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: fontSize.caption,
              marginTop: spacing.sm,
            }}
          >
            {photoNote}
          </Text>
        )}
      </ScrollView>

      <View
        style={{
          padding: spacing.lg,
          paddingBottom: spacing.sm,
          gap: spacing.sm,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
        }}
      >
        {failed && (
          <Text style={{ color: colors.text, fontSize: fontSize.caption, textAlign: 'center' }}>
            {t('label.saveProblem')}
          </Text>
        )}
        <Button label={t('label.save')} onPress={() => void save()} disabled={saving} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
});
