import { useState } from 'react';
import {
  Image,
  type ImageSourcePropType,
  type ImageStyle,
  StyleSheet,
  type StyleProp,
  View,
  type ViewStyle,
} from 'react-native';

import { palette } from '@/theme';

const PARK_COVER = require('../../assets/images/blindbox-scene-park.png');
const CAFE_COVER = require('../../assets/images/blindbox-scene-cafe.png');
const EXHIBITION_COVER = require('../../assets/images/blindbox-scene-amusement.png');
const DEFAULT_COVER = require('../../assets/images/blindbox-scene-amusement.png');

type ActivityCoverImageProps = {
  activityTitle: string;
  imageStyle?: StyleProp<ImageStyle>;
  style?: StyleProp<ViewStyle>;
  uri?: string | null;
};

function getFallbackCover(activityTitle: string): ImageSourcePropType {
  if (/咖啡|奶茶|茶馆|甜品|烘焙|美食|餐厅/.test(activityTitle)) {
    return CAFE_COVER;
  }

  if (/展|美术馆|博物馆|画廊|艺术/.test(activityTitle)) {
    return EXHIBITION_COVER;
  }

  if (/公园|散步|徒步|户外|骑行|郊游/.test(activityTitle)) {
    return PARK_COVER;
  }

  return DEFAULT_COVER;
}

export function ActivityCoverImage({
  activityTitle,
  imageStyle,
  style,
  uri,
}: ActivityCoverImageProps) {
  const normalizedUri = uri?.trim() ?? '';
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const canShowRemoteImage = Boolean(normalizedUri && failedUri !== normalizedUri);
  const source = canShowRemoteImage ? { uri: normalizedUri } : getFallbackCover(activityTitle);

  return (
    <View style={[styles.frame, style]}>
      <Image
        accessibilityLabel={`${activityTitle}目的地图片`}
        onError={canShowRemoteImage ? () => setFailedUri(normalizedUri) : undefined}
        resizeMode="cover"
        source={source}
        style={[styles.image, imageStyle]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: palette.skySoft,
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
