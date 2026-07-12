import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SettingsNavigationProps } from './navigation_types';
import { prefs, Schema, schema, SettingApplicability } from '@common/schema';
import {
  CommaSeparatedInputProperties,
  flagImageSource,
  styles,
} from './prefs_common';

interface NumberSettingInputProperties {
  initialValue: number;
  min: number;
  max: number;
  summary: string;
  description: string;
  onValueChange: (value: number) => void;
}

const NumberSettingInput: React.FC<NumberSettingInputProperties> = ({
  initialValue,
  min,
  max,
  summary,
  description,
  onValueChange,
}) => {
  const [inputValue, setInputValue] = useState(String(initialValue));

  const handleTextChange = (text: string) => {
    const numericValue = text.replace(/[^0-9]/g, '');
    setInputValue(numericValue);
    const num = Number(numericValue);
    if (!isNaN(num)) {
      const constrainedValue = Math.max(min, Math.min(max, num));
      onValueChange(constrainedValue);
    } else if (numericValue === '') {
      onValueChange(min);
    }
  };

  useEffect(() => {
    setInputValue(String(initialValue));
  }, [initialValue]);

  return (
    <View style={styles.settingItem}>
      <View style={styles.textContainer}>
        <Text style={styles.title}>{summary}</Text>
        <Text style={styles.description}>{description}</Text>
        <Text style={styles.rangeInfo}>
          Min: {min}, Max: {max}
        </Text>
      </View>
      <TextInput
        style={styles.input}
        onChangeText={handleTextChange}
        value={inputValue}
        keyboardType="numeric"
        maxLength={String(max).length + (String(min)[0] === '-' ? 1 : 0)}
      />
    </View>
  );
};

const CommaSeparatedInput: React.FC<CommaSeparatedInputProperties> = ({
  initialValuesArray = [],
  summary,
  description,
  onChange,
}) => {
  const [valuesArray, setValuesArray] = useState(initialValuesArray);
  const [csvInput, setCsvInput] = useState(initialValuesArray.join(', '));

  const updateValues = (newArray: string[]) => {
    setValuesArray(newArray);
    if (onChange) {
      onChange(newArray);
    }
  };

  const handleInputChange = (text: string) => {
    setCsvInput(text);
    const newValuesArray = text
      .split(',')
      .map(item => item.trim())
      .filter(item => item.length > 0);
    updateValues(newValuesArray);
  };

  const deleteValue = (indexToDelete: number) => {
    const newArray = valuesArray.filter((_, index) => index !== indexToDelete);
    updateValues(newArray);
    const newCsvString = newArray.join(', ');
    setCsvInput(newCsvString);
  };

  return (
    <View style={styles.container}>
      <View style={styles.textContainer}>
        <Text style={styles.title}>{summary}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>

      <TextInput
        style={styles.textInput}
        onChangeText={handleInputChange}
        value={csvInput}
        placeholder={'Enter values separated by commas'}
        multiline={true}
      />

      <Text style={styles.arrayOutputTitle}>Current Values:</Text>
      <View style={styles.arrayOutput}>
        {valuesArray.map((value, index) => (
          <View key={index} style={styles.tag}>
            <Text style={styles.tagText}>{value}</Text>
            <TouchableOpacity
              onPress={() => deleteValue(index)}
              style={styles.deleteButton}
            >
              <Text style={styles.deleteButtonText}>X</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>
    </View>
  );
};

export const PreferencesScreen = ({
  route,
  navigation,
}: SettingsNavigationProps) => {
  const { settings } = route.params;
  const [loaded, setLoaded] = useState(false);
  const [settingValues, setSettingValues] = useState<Map<string, any>>(
    new Map(),
  );

  useEffect(() => {
    const loadSettings = async () => {
      const tempSettingsMap = new Map<string, any>();

      const loadSingleSetting = async (pname: keyof Schema) => {
        if (tempSettingsMap.has(pname)) return;

        const property = schema[pname];
        if (!property) return;

        switch (property.type) {
          case 'boolean':
            const boolVal = await settings.getBoolean(pname);
            tempSettingsMap.set(pname, boolVal);
            if (property.dependent) {
              await Promise.all(
                property.dependent.map(async depName => {
                  await loadSingleSetting(depName); // Recursive load
                }),
              );
            }
            break;
          case 'number':
            tempSettingsMap.set(pname, await settings.getInt(pname));
            break;
          case 'array':
            tempSettingsMap.set(pname, await settings.getStrv(pname));
            break;
        }
      };

      await Promise.all(
        prefs.map(async prefGroup => {
          await Promise.all(
            prefGroup.properties.map(pname => loadSingleSetting(pname)),
          );
        }),
      );

      setSettingValues(tempSettingsMap);
      setLoaded(true);
    };

    loadSettings();
  }, [settings]);

  if (!loaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  const toggleSwitch = (key: string, value: boolean) => {
    settingValues.set(key, value);
    setSettingValues(new Map(settingValues));
    settings.setBoolean(key, value);
  };

  const setNumericValue = (key: string, value: number) => {
    settingValues.set(key, value);
    setSettingValues(new Map(settingValues));
    settings.setInt(key, value);
  };

  const handleTagsChange = (key: string, values: string[]) => {
    settingValues.set(key, values);
    setSettingValues(new Map(settingValues));
    settings.setStrv(key, values);
  };

  const renderSettingItem = (pname: keyof Schema, isNested = false) => {
    const property = schema[pname];
    if (!property) return null;

    const containerStyle = isNested
      ? [styles.settingItem, { marginLeft: 20 }]
      : styles.settingItem;
    const fallbackContainerStyle = isNested
      ? [styles.container, { marginLeft: 20 }]
      : styles.container;

    switch (property.type) {
      case 'boolean':
        const isChecked = !!settingValues.get(pname);
        return (
          <React.Fragment key={pname}>
            <View style={containerStyle}>
              <View key={pname} style={styles.textContainer}>
                <Text style={styles.title}>{property.summary}</Text>
                <Text style={styles.description}>{property.description}</Text>
              </View>
              <Switch
                onValueChange={value => toggleSwitch(pname, value)}
                value={isChecked}
              />
            </View>

            {isChecked &&
              property.dependent &&
              property.dependent.map(depName =>
                renderSettingItem(depName, true),
              )}
          </React.Fragment>
        );

      case 'number':
        return (
          <View key={pname} style={isNested ? { marginLeft: 20 } : null}>
            <NumberSettingInput
              key={pname}
              summary={property.summary!}
              description={property.description!}
              min={property.minimum || 0}
              max={property.maximum || 100}
              initialValue={settingValues.get(pname)}
              onValueChange={(value: number) => setNumericValue(pname, value)}
            />
          </View>
        );
      case 'array':
        if (
          !property.items ||
          (property.items.type === 'string' &&
            (!property.items.enum || property.items.enum !== 'country'))
        ) {
          return (
            <View key={pname} style={isNested ? { marginLeft: 20 } : null}>
              <CommaSeparatedInput
                key={pname}
                summary={property.summary!}
                description={property.description!}
                initialValuesArray={settingValues.get(pname)}
                onChange={(values: string[]) => handleTagsChange(pname, values)}
              />
            </View>
          );
        } else {
          const selectedCountryCodes =
            (settingValues.get(pname) as string[]) || [];
          return (
            <View style={fallbackContainerStyle} key={pname}>
              <View style={styles.textContainer}>
                <Text style={styles.title}>{property.summary}</Text>
                <Text style={styles.description}>{property.description}</Text>
              </View>
              <TouchableOpacity
                onPress={() =>
                  navigation.navigate('CountrySettings', {
                    summary: property.summary!,
                    description: property.description!,
                    key: pname,
                    initialValues: settingValues.get(pname),
                    settings: settings,
                  })
                }
              >
                <Text key="country-selection">Current Selection:</Text>
                {selectedCountryCodes.length > 0 ? (
                  selectedCountryCodes.map(code => (
                    <Image
                      key={code}
                      source={flagImageSource(code)}
                      style={styles.flag}
                    />
                  ))
                ) : (
                  <Text>No country selected</Text>
                )}
              </TouchableOpacity>
            </View>
          );
        }
    }
    return null;
  };

  return (
    <ScrollView style={styles.container}>
      {prefs.map(prefGroup => {
        const applicableProperties = prefGroup.properties.filter(pname => {
          const property = schema[pname];
          return (
            !property.applicability ||
            property.applicability.includes(SettingApplicability.ReactNativeApp)
          );
        });

        if (applicableProperties.length === 0) {
          return null;
        }

        return (
          <View key={prefGroup.title}>
            <Text style={styles.header}>{prefGroup.title}</Text>
            <Text style={styles.headerDescription}>
              {prefGroup.description}
            </Text>

            {applicableProperties.map(pname => renderSettingItem(pname, false))}
          </View>
        );
      })}
    </ScrollView>
  );
};
