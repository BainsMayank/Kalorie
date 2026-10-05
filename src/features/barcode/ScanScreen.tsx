import Ionicons from '@expo/vector-icons/Ionicons';
import {
  CameraView,
  scanFromURLAsync,
  useCameraPermissions,
  type BarcodeScanningResult,
} from 'expo-camera';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomSheet, Button } from '@/components';
import { QuickAddSheet } from '@/features/log/QuickAddSheet';
import { PACKET_BARCODE_TYPES, barcodeFromScan } from '@/lib/barcode';
import { useBarcodeQueueStore } from '@/stores/barcodeQueue';
import { useLogStore } from '@/stores/log';
import { useTheme } from '@/theme';

import { lookupBarcode } from './lookup';
import { TypeCodeSheet } from './TypeCodeSheet';

// iOS can read only QR codes from a photo (expo-camera's scanFromURLAsync uses Apple's QR-only
// detector), so *Pick from gallery* is offered on Android only (SPEC §2.7).
const GALLERY_SCAN = Platform.OS === 'android';

type Phase =
  | { kind: 'scanning' }
  | { kind: 'looking'; code: string }
  /** Couldn't reach Open Food Facts: the barcode waits in the queue. */
  | { kind: 'offline'; code: string };

/**
 * The barcode scanner (SPEC §2.7): the camera with a frame and a light switch, *Type the number*,
 * and *Pick from gallery* on Android. A code that reads right is looked up — saved products first,
 * then Open Food Facts — and opens the product, the label form, or (offline) waits in the queue.
 * `slot`: the meal "+ Add" was tapped on, passed on to the product.
 */
export function ScanScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors, spacing, fontSize, radius, minTapTarget } = useTheme();
  const { slot } = useLocalSearchParams<{ slot?: string }>();
  const day = useLogStore((state) => state.day);
  const enqueue = useBarcodeQueueStore((state) => state.enqueue);
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [cameraFailed, setCameraFailed] = useState(false);
  const [typing, setTyping] = useState(false);
  const [quickAdd, setQuickAdd] = useState(false);
  const [phase, setPhase] = useState<Phase>({ kind: 'scanning' });
  const [note, setNote] = useState<string | null>(null);
  // The camera reports the same barcode many times a second: only the first one counts.
  const busy = useRef(false);

  const slotParam = slot ? { slot } : {};

  const lookUp = async (code: string) => {
    if (busy.current) return;
    busy.current = true;
    setTyping(false);
    setNote(null);
    setPhase({ kind: 'looking', code });
    try {
      const result = await lookupBarcode(code);
      switch (result.kind) {
        case 'found':
          router.replace({
            pathname: '/food/[id]',
            params: { id: result.foodId, source: 'custom', ...slotParam },
          });
          return;
        case 'not_found':
        case 'no_nutrition':
          router.replace({
            pathname: '/label',
            params: {
              barcode: code,
              reason: result.kind,
              ...(result.kind === 'no_nutrition'
                ? { name: result.name ?? '', brand: result.brand ?? '' }
                : {}),
              ...slotParam,
            },
          });
          return;
        case 'offline':
          await enqueue({ barcode: code, day, slotId: slot ?? null });
          setPhase({ kind: 'offline', code });
          return;
      }
    } catch {
      setNote(t('scan.lookupProblem'));
      scanAgain();
    }
  };

  const scanAgain = () => {
    busy.current = false;
    setPhase({ kind: 'scanning' });
  };

  const onScanned = ({ type, data }: BarcodeScanningResult) => {
    const code = barcodeFromScan(type, data);
    if (code === null || busy.current) return; // not a packet barcode, or misread: keep looking
    Haptics.selectionAsync().catch(() => {});
    void lookUp(code);
  };

  const pickFromGallery = async () => {
    setNote(null);
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'] });
    if (picked.canceled) return;
    try {
      const found = await scanFromURLAsync(picked.assets[0].uri, [...PACKET_BARCODE_TYPES]);
      const code = found.map((r) => barcodeFromScan(r.type, r.data)).find((c) => c !== null);
      if (code) void lookUp(code);
      else setNote(t('scan.galleryNone'));
    } catch {
      setNote(t('scan.galleryProblem'));
    }
  };

  const canScan = permission?.granted === true && !cameraFailed;

  return (
    <SafeAreaView edges={['bottom']} style={[styles.flex, { backgroundColor: colors.background }]}>
      {/* The camera, or why there is none */}
      <View style={styles.flex}>
        {canScan ? (
          <>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              enableTorch={torch}
              barcodeScannerSettings={{ barcodeTypes: [...PACKET_BARCODE_TYPES] }}
              onBarcodeScanned={phase.kind === 'scanning' && !typing ? onScanned : undefined}
              onMountError={() => setCameraFailed(true)}
            />
            <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
              <Text
                style={{
                  color: colors.onCamera,
                  fontSize: fontSize.body,
                  textAlign: 'center',
                  backgroundColor: colors.cameraOverlay,
                  borderRadius: radius.md,
                  overflow: 'hidden',
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  marginBottom: spacing.lg,
                }}
              >
                {t('scan.hint')}
              </Text>
              <View
                testID="scan-frame"
                style={{
                  width: '80%',
                  height: 150,
                  borderWidth: 2,
                  borderColor: colors.onCamera,
                  borderRadius: radius.md,
                }}
              />
            </View>
            <Pressable
              accessibilityRole="switch"
              accessibilityLabel={t(torch ? 'scan.torchOff' : 'scan.torchOn')}
              accessibilityState={{ checked: torch }}
              onPress={() => setTorch((on) => !on)}
              style={[
                styles.center,
                styles.torch,
                {
                  top: spacing.lg,
                  right: spacing.lg,
                  width: minTapTarget,
                  height: minTapTarget,
                  borderRadius: minTapTarget / 2,
                  backgroundColor: colors.cameraOverlay,
                },
              ]}
            >
              <Ionicons
                name={torch ? 'flashlight' : 'flashlight-outline'}
                size={22}
                color={colors.onCamera}
              />
            </Pressable>
            {phase.kind === 'looking' && (
              <View
                style={[
                  StyleSheet.absoluteFill,
                  styles.center,
                  { backgroundColor: colors.cameraOverlay },
                ]}
              >
                <ActivityIndicator color={colors.onCamera} />
                <Text
                  style={{ color: colors.onCamera, fontSize: fontSize.body, marginTop: spacing.md }}
                >
                  {t('scan.looking', { code: phase.code })}
                </Text>
              </View>
            )}
          </>
        ) : (
          <PermissionPanel
            permission={permission}
            cameraFailed={cameraFailed}
            onAllow={() => void requestPermission()}
          />
        )}
      </View>

      {/* Other ways in */}
      <View style={{ padding: spacing.lg, gap: spacing.sm }}>
        {note && (
          <Text style={{ color: colors.text, fontSize: fontSize.body, textAlign: 'center' }}>
            {note}
          </Text>
        )}
        {!canScan && phase.kind === 'looking' && (
          <Text
            style={{ color: colors.textSecondary, fontSize: fontSize.body, textAlign: 'center' }}
          >
            {t('scan.looking', { code: phase.code })}
          </Text>
        )}
        <Button kind="secondary" label={t('scan.type')} onPress={() => setTyping(true)} />
        {GALLERY_SCAN && (
          <Button
            kind="secondary"
            label={t('scan.gallery')}
            onPress={() => void pickFromGallery()}
          />
        )}
      </View>

      {typing && (
        <TypeCodeSheet onClose={() => setTyping(false)} onCode={(code) => void lookUp(code)} />
      )}

      {phase.kind === 'offline' && !quickAdd && (
        <BottomSheet
          title={t('scan.offlineTitle')}
          onClose={scanAgain}
          footer={
            <View style={{ gap: spacing.sm }}>
              <Button label={t('scan.quickAdd')} onPress={() => setQuickAdd(true)} />
              <Button
                kind="secondary"
                label={t('scan.addFromLabel')}
                onPress={() =>
                  router.replace({
                    pathname: '/label',
                    params: { barcode: phase.code, reason: 'offline', ...slotParam },
                  })
                }
              />
              <Button kind="text" label={t('scan.scanAnother')} onPress={scanAgain} />
            </View>
          }
        >
          <Text style={{ color: colors.text, fontSize: fontSize.body }}>
            {t('scan.offlineBody', { code: phase.code })}
          </Text>
        </BottomSheet>
      )}
      {quickAdd && (
        <QuickAddSheet
          mode="add"
          day={day}
          slotId={slot}
          onClose={() => setQuickAdd(false)}
          onSaved={() => {
            setQuickAdd(false);
            if (router.canGoBack()) router.back();
          }}
        />
      )}
    </SafeAreaView>
  );
}

/** Why the camera isn't showing: permission not asked yet, refused for good, or broken. */
function PermissionPanel({
  permission,
  cameraFailed,
  onAllow,
}: {
  permission: ReturnType<typeof useCameraPermissions>[0];
  cameraFailed: boolean;
  onAllow: () => void;
}) {
  const { t } = useTranslation();
  const { colors, spacing, fontSize } = useTheme();
  if (!permission) return null; // still checking

  let body: string;
  let action: { label: string; onPress: () => void } | null = null;
  if (cameraFailed) {
    body = t('scan.cameraProblem');
  } else if (permission.canAskAgain) {
    body = t('scan.permissionReason');
    action = { label: t('scan.allow'), onPress: onAllow };
  } else {
    body = t('scan.blocked');
    action = { label: t('scan.openSettings'), onPress: () => void Linking.openSettings() };
  }

  return (
    <View style={[styles.flex, styles.center, { padding: spacing.xl, gap: spacing.lg }]}>
      <Ionicons name="barcode-outline" size={56} color={colors.textSecondary} />
      <Text
        accessibilityRole="header"
        style={{
          color: colors.text,
          fontSize: fontSize.title,
          fontWeight: '600',
          textAlign: 'center',
        }}
      >
        {t('scan.permissionTitle')}
      </Text>
      <Text style={{ color: colors.textSecondary, fontSize: fontSize.body, textAlign: 'center' }}>
        {body}
      </Text>
      {action && (
        <View style={{ alignSelf: 'stretch' }}>
          <Button label={action.label} onPress={action.onPress} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  torch: { position: 'absolute' },
});
