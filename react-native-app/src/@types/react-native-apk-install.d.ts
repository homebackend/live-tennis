declare module 'react-native-apk-install' {
  const APKInstaller: {
    install: (filePath: string) => Promise<void>;
  };
  export default APKInstaller;
}
