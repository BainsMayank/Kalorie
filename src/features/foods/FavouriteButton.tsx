import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { Pressable } from 'react-native';

import { foodKey, type FoodSourceKind } from '@/lib/suggestions';
import { useFavouritesStore } from '@/stores/favourites';
import { useTheme } from '@/theme';

/** ☆ / ★ : stars a food so it shows in the Favourites tab of Add food. */
export function FavouriteButton({
  foodSource,
  foodId,
  name,
}: {
  foodSource: FoodSourceKind;
  foodId: string;
  name: string;
}) {
  const { t } = useTranslation();
  const { colors, minTapTarget } = useTheme();
  const starred = useFavouritesStore((state) => state.keys.includes(foodKey(foodSource, foodId)));
  const toggle = useFavouritesStore((state) => state.toggle);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t(starred ? 'favourite.remove' : 'favourite.add', { name })}
      accessibilityState={{ selected: starred }}
      onPress={() => {
        toggle(foodSource, foodId).catch(() => {});
      }}
      hitSlop={4}
      style={({ pressed }) => ({
        width: minTapTarget,
        height: minTapTarget,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.5 : 1,
      })}
    >
      {/* The filled star uses the text colour: favourites are a choice, not a judgement. */}
      <Ionicons
        name={starred ? 'star' : 'star-outline'}
        size={22}
        color={starred ? colors.text : colors.textSecondary}
      />
    </Pressable>
  );
}
