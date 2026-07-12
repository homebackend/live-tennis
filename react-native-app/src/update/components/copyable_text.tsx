import { View, Text, Pressable, Linking } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import Icon from 'react-native-vector-icons/MaterialIcons';

export const CopyableText = ({ text }: { text: string }) => (
  <View
    style={{
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: '#ccc',
      borderRadius: 16,
      paddingLeft: 12,
    }}
  >
    <Text numberOfLines={1} style={{ flex: 1 }}>
      {text}
    </Text>
    {text.startsWith('http') && (
      <Pressable onPress={() => Linking.openURL(text)} style={{ padding: 8 }}>
        <Icon name="link" size={20} color="#6750A4" />
      </Pressable>
    )}
    <Pressable onPress={() => Clipboard.setString(text)} style={{ padding: 8 }}>
      <Icon name="content-copy" size={20} color="#6750A4" />
    </Pressable>
  </View>
);
