import { Modal, View, Text, Pressable } from 'react-native';

export const ErrorDialog = ({ visible, message, onRetry, onDismiss }: any) => (
  <Modal visible={visible} transparent animationType="fade">
    <View
      style={{
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <View style={{ backgroundColor: 'white', borderRadius: 16, padding: 20 }}>
        <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 8 }}>
          Update Failed
        </Text>
        <Text style={{ color: '#444', marginBottom: 20 }}>
          {message || 'Could not check for updates.'}
        </Text>
        <View
          style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}
        >
          <Pressable onPress={onDismiss} style={{ padding: 10 }}>
            <Text>Continue</Text>
          </Pressable>
          {onRetry && (
            <Pressable
              onPress={onRetry}
              style={{
                backgroundColor: '#B3261E',
                borderRadius: 8,
                paddingHorizontal: 16,
                paddingVertical: 10,
              }}
            >
              <Text style={{ color: 'white', fontWeight: '600' }}>Retry</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  </Modal>
);
