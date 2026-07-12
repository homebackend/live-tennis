import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import {
  AppInitializationState,
  AppUpdateState,
  OtaStatus,
} from '@common/update/types';

type Props = {
  currentVersion: string;
  latestVersion: string;
  changelog: string;
  downloadUrl: string;
  state: AppInitializationState | AppUpdateState;
  otaEvent?: { status: OtaStatus; value: string };
  errorMessage?: string;
  onUpdate: () => void;
  onSkip: () => void;
  onClose: () => void;
};

export const UpdateWindow: React.FC<Props> = ({
  currentVersion,
  latestVersion,
  changelog,
  state,
  otaEvent,
  errorMessage,
  onUpdate,
  onSkip,
  onClose,
}) => {
  const isDownloading = otaEvent?.status === OtaStatus.DOWNLOADING;
  const isInstalling = otaEvent?.status === OtaStatus.INSTALLING;
  const isInProgress =
    state === ('inProgress' as any) || state === AppUpdateState.inProgress;
  const isError =
    state === ('updateCheckFailed' as any) || state === AppUpdateState.error;

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Update Available</Text>
        <View style={styles.versionRow}>
          <Text style={styles.versionPill}>{currentVersion}</Text>
          <Text style={styles.arrow}> → </Text>
          <Text style={[styles.versionPill, styles.versionNew]}>
            {latestVersion}
          </Text>
        </View>

        <ScrollView style={styles.changelog} showsVerticalScrollIndicator>
          <Text style={styles.changelogTitle}>What's new</Text>
          <Text style={styles.changelogText}>
            {changelog || 'Bug fixes and improvements.'}
          </Text>
        </ScrollView>

        {isInProgress && (
          <View style={styles.progressBox}>
            <ActivityIndicator />
            <Text style={styles.progressText}>
              {isDownloading
                ? `Downloading ${otaEvent?.value}`
                : isInstalling
                ? 'Installing...'
                : otaEvent?.value}
            </Text>
          </View>
        )}

        {isError && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>
              {errorMessage || otaEvent?.value || 'Update failed'}
            </Text>
          </View>
        )}

        <View style={styles.actions}>
          <TouchableOpacity
            onPress={onSkip}
            disabled={isInProgress as boolean}
            style={styles.btnSecondary}
          >
            <Text style={styles.btnSecondaryText}>Skip</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={isError ? onClose : onUpdate}
            disabled={isInProgress as boolean}
            style={[styles.btnPrimary, isInProgress && { opacity: 0.5 }]}
          >
            <Text style={styles.btnPrimaryText}>
              {isError ? 'Close' : 'Update Now'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    maxHeight: '85%',
  },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
  versionRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  versionPill: {
    backgroundColor: '#eee',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    fontSize: 13,
  },
  versionNew: {
    backgroundColor: '#E3F2FD',
    color: '#1565C0',
    fontWeight: '600',
  },
  arrow: { marginHorizontal: 6, color: '#888' },
  changelog: { maxHeight: 220, marginBottom: 16 },
  changelogTitle: { fontWeight: '600', marginBottom: 6 },
  changelogText: { color: '#444', lineHeight: 20 },
  progressBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
  },
  progressText: { marginLeft: 10, fontSize: 13 },
  errorBox: {
    backgroundColor: '#FDECEA',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  errorText: { color: '#B3261E', fontSize: 13 },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 4,
  },
  btnSecondary: { paddingHorizontal: 16, paddingVertical: 10 },
  btnSecondaryText: { color: '#666', fontWeight: '600' },
  btnPrimary: {
    backgroundColor: '#1565C0',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  btnPrimaryText: { color: '#fff', fontWeight: '700' },
});
