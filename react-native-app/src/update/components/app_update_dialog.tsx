import { Modal, View, Text, ScrollView, Pressable } from 'react-native';
import { CopyableText } from './copyable_text';

export const AppUpdateDialog = ({
  visible,
  downloadUrl,
  latestVersion,
  changeLog,
  onProceed,
  onDismiss,
}: any) => (
  <Modal visible={visible} transparent animationType="fade">
    <View
      style={{
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <View
        style={{
          backgroundColor: 'white',
          borderRadius: 16,
          padding: 16,
          maxHeight: '80%',
        }}
      >
        <Text style={{ fontWeight: 'bold', fontSize: 18, marginBottom: 12 }}>
          New Update Available
        </Text>
        <Text style={{ fontWeight: '600' }}>
          Latest Version: {latestVersion ?? 'Unknown'}
        </Text>
        {downloadUrl && (
          <View style={{ marginVertical: 12 }}>
            <Text style={{ fontWeight: '600' }}>Package Link:</Text>
            <CopyableText text={downloadUrl} />
          </View>
        )}
        <Text style={{ fontWeight: '600', marginTop: 8 }}>
          Changelog / Commits:
        </Text>
        <ScrollView
          style={{
            backgroundColor: '#F3F0F7',
            borderRadius: 8,
            padding: 12,
            marginTop: 8,
            maxHeight: 200,
          }}
        >
          <Text style={{ fontFamily: 'monospace' }}>
            {changeLog || 'No direct commit information provided.'}
          </Text>
        </ScrollView>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'flex-end',
            marginTop: 16,
            gap: 12,
          }}
        >
          <Pressable onPress={onDismiss}>
            <Text style={{ padding: 10 }}>Dismiss</Text>
          </Pressable>
          <Pressable
            onPress={onProceed}
            style={{
              backgroundColor: '#6750A4',
              borderRadius: 8,
              paddingHorizontal: 16,
              paddingVertical: 10,
            }}
          >
            <Text style={{ color: 'white' }}>
              {onProceed ? 'Install Update' : 'OK'}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  </Modal>
);
