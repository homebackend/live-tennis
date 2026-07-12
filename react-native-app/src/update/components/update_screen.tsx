import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { AppUpdateState, AppUpdateStatus } from '@common/update/types';

export const UpdateScreen = ({ updateCubit, onBack, onError }: any) => {
  const [status, setStatus] = useState(updateCubit.state);

  useEffect(() => {
    const sub = updateCubit.on('state', (s: AppUpdateStatus) => {
      setStatus(s);
      if (s.state === AppUpdateState.skipped) onBack();
      if (s.state === AppUpdateState.error) onError(s.error);
    });

    return () => {
      sub?.remove?.();
      updateCubit.close();
    };
  });

  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
      }}
    >
      <Text>
        Update in progress: {status.event?.status} {status.event?.value}
      </Text>
    </View>
  );
};
