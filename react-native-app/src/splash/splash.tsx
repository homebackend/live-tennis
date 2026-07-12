import { View, ActivityIndicator, Image } from 'react-native';
export const SplashScreen = ({ icon }: { icon: any }) => (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
    <Image
      source={icon}
      style={{ width: 120, height: 120 }}
      resizeMode="contain"
    />
    <ActivityIndicator style={{ marginTop: 20 }} size="large" />
  </View>
);
