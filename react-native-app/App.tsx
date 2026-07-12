// App.tsx
import * as React from 'react';
import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootStackParamList } from './src/navigation_types';
import { MainMenu } from './src/menu';
import { PreferencesScreen } from './src/prefs';
import { CountryPreferencesScreen } from './src/prefs_countries';
import { useColorScheme } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { SplashScreen } from './src/splash/splash';
import { AppInitializationCubit } from '../src/common/update/app_initialization_cubit';
import {
  organization,
  repo,
  baseAssetName,
} from '../src/common/update/constants';
import { RNUpdateEnv } from './src/update/rn_env';
import { RNAppUpdateCubit } from './src/update/app_update_cubit';
import {
  AppInitializationState,
  AppInitializationStatus,
} from '../src/common/update/types';
import { AppUpdateDialog } from './src/update/components/app_update_dialog';
import { UpdateScreen } from './src/update/components/update_screen';
import { ErrorDialog } from './src/update/components/error_dialog';

const Stack = createNativeStackNavigator<RootStackParamList>();

type UpdateData = {
  currentVersion: string;
  latestVersion: string;
  changeLog: string;
  downloadUrl: string;
};

function App() {
  const scheme = useColorScheme();
  const [route, setRoute] = useState<string | null>(null);
  const [updateData, setUpdateData] = useState<UpdateData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const updateCubitRef = useRef<RNAppUpdateCubit | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const env = new RNUpdateEnv();
        const initCubit = new AppInitializationCubit(
          organization,
          repo,
          baseAssetName,
          env,
          console.log,
        );
        updateCubitRef.current = new RNAppUpdateCubit(
          baseAssetName,
          env,
          console.log,
        );

        const sub = initCubit.on(
          'state',
          async (status: AppInitializationStatus) => {
            if (status.state === AppInitializationState.showUpdateDetails) {
              console.log('AppInitializationState.showUpdateDetails');
              const current = await env.getCurrentInfo();
              setUpdateData({
                currentVersion: current.version,
                latestVersion: status.latestVersion!,
                changeLog: status.changeLog!,
                downloadUrl: status.downloadUrl!,
              });

              setRoute('ask-user');
            }

            if (status.state === AppInitializationState.updateCheckFailed) {
              setError(status.error);
              setRoute('error');
            }

            if (status.state === AppInitializationState.initialized) {
              setRoute('home');
            }
          },
        );

        await initCubit.checkUpdateRequired();

        return () => {
          sub?.remove?.();
          initCubit.close();
        };
      } catch {
        setRoute('home');
      }
    })();
  }, []);

  if (!route) {
    return <SplashScreen icon={require('./icons/tennis-icon.png')} />;
  }

  if (updateData && route === 'ask-user') {
    return (
      <AppUpdateDialog
        visible={true}
        downloadUrl={updateData.downloadUrl}
        latestVersion={updateData.latestVersion}
        changeLog={updateData.changeLog}
        onProceed={async () => {
          setRoute('update');
          updateCubitRef.current?.tryUpdate(updateData.downloadUrl);
        }}
        onDismiss={() => {
          setRoute('home');
        }}
      />
    );
  }

  if (route === 'update') {
    return (
      <UpdateScreen
        updateCubit={updateCubitRef.current}
        onBack={() => setRoute('home')}
        onError={(err: string) => {
          setError(err);
          setRoute('error');
        }}
      />
    );
  }

  if (route === 'error' && error) {
    return (
      <ErrorDialog
        visible={true}
        message={error}
        onDismiss={() => setRoute('home')}
      />
    );
  }

  return (
    <NavigationContainer theme={scheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack.Navigator initialRouteName="Home">
        <Stack.Screen
          name="Home"
          component={MainMenu}
          options={{ title: 'Live Tennis' }}
        />
        <Stack.Screen
          name="Settings"
          component={PreferencesScreen}
          options={{ title: `Settings` }}
        />
        <Stack.Screen
          name="CountrySettings"
          component={CountryPreferencesScreen}
          options={{ title: `Country Settings` }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default App;
