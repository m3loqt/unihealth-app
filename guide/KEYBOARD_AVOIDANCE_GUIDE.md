# Keyboard Avoidance Implementation Guide

This guide explains how to implement robust keyboard avoidance in the UniHealth app to ensure input fields are always visible when the keyboard is open.

## Overview

The keyboard avoidance system consists of three main components:

1. **`useKeyboardAvoidance` Hook** - Provides keyboard state and utilities
2. **`KeyboardAvoidingScrollView` Component** - A ScrollView with built-in keyboard avoidance
3. **`KeyboardAwareInput` Component** - An input field that automatically scrolls into view

## Quick Start

### Basic Implementation

```tsx
import { KeyboardAvoidingScrollView, KeyboardAwareInput } from '../src/components/ui';

export default function DiagnosisScreen() {
  const [diagnosis, setDiagnosis] = useState('');

  return (
    <KeyboardAvoidingScrollView extraOffset={20}>
      <KeyboardAwareInput
        placeholder="Enter diagnosis..."
        value={diagnosis}
        onChangeText={setDiagnosis}
        multiline
        numberOfLines={3}
      />
    </KeyboardAvoidingScrollView>
  );
}
```

## Components

### 1. useKeyboardAvoidance Hook

Provides keyboard state and utilities for custom implementations.

```tsx
import { useKeyboardAvoidance } from '../src/hooks/ui/useKeyboardAvoidance';

const {
  keyboardHeight,        // Animated value for keyboard height
  keyboardHeightValue,   // Current keyboard height in pixels
  isKeyboardVisible,     // Boolean indicating if keyboard is visible
  dismissKeyboard,       // Function to dismiss keyboard
  scrollToInput,         // Function to scroll to specific input
} = useKeyboardAvoidance({
  extraOffset: 20,       // Additional offset (default: 0)
  enabled: true,         // Enable/disable (default: true)
  animationDuration: 250, // Animation duration (default: 250ms)
  useNativeDriver: true, // Use native driver (default: true)
});
```

### 2. KeyboardAvoidingScrollView

A ScrollView component with built-in keyboard avoidance.

```tsx
<KeyboardAvoidingScrollView
  extraOffset={20}                    // Additional offset from keyboard
  enabled={true}                      // Enable keyboard avoidance
  keyboardBehavior="padding"          // iOS: 'padding' | 'position' | 'height'
  enableKeyboardAvoidingView={true}   // Enable KeyboardAvoidingView wrapper
  contentContainerStyle={{ paddingBottom: 100 }}
>
  {/* Your content */}
</KeyboardAvoidingScrollView>
```

**Props:**
- `extraOffset?: number` - Additional offset to add to keyboard height
- `enabled?: boolean` - Whether to enable keyboard avoidance
- `keyboardBehavior?: 'height' | 'position' | 'padding'` - Keyboard behavior
- `enableKeyboardAvoidingView?: boolean` - Enable KeyboardAvoidingView wrapper

### 3. KeyboardAwareInput

A TextInput component that automatically scrolls into view when focused.

```tsx
<KeyboardAwareInput
  placeholder="Enter text..."
  value={value}
  onChangeText={setValue}
  enableKeyboardAvoidance={true}  // Enable auto-scroll (default: true)
  scrollOffset={20}               // Scroll offset (default: 20)
  multiline
  numberOfLines={3}
/>
```

## Implementation Examples

### Example 1: Simple Form

```tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { KeyboardAvoidingScrollView, KeyboardAwareInput } from '../src/components/ui';

export default function SimpleForm() {
  const [diagnosis, setDiagnosis] = useState('');
  const [notes, setNotes] = useState('');

  return (
    <KeyboardAvoidingScrollView extraOffset={20}>
      <View style={styles.form}>
        <Text style={styles.label}>Diagnosis</Text>
        <KeyboardAwareInput
          style={styles.input}
          placeholder="Enter diagnosis..."
          value={diagnosis}
          onChangeText={setDiagnosis}
        />
        
        <Text style={styles.label}>Notes</Text>
        <KeyboardAwareInput
          style={[styles.input, styles.multilineInput]}
          placeholder="Enter notes..."
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={4}
        />
      </View>
    </KeyboardAvoidingScrollView>
  );
}
```

### Example 2: Advanced Form with Custom Keyboard Handling

```tsx
import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { 
  KeyboardAvoidingScrollView, 
  KeyboardAwareInput 
} from '../src/components/ui';
import { useKeyboardAvoidance } from '../src/hooks/ui/useKeyboardAvoidance';

export default function AdvancedForm() {
  const [formData, setFormData] = useState({
    diagnosis: '',
    treatment: '',
    notes: '',
  });

  const { isKeyboardVisible, dismissKeyboard } = useKeyboardAvoidance();
  const scrollViewRef = useRef<any>(null);

  const handleSubmit = () => {
    dismissKeyboard();
    // Handle form submission
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Diagnosis Form</Text>
        {isKeyboardVisible && (
          <TouchableOpacity onPress={dismissKeyboard}>
            <Text style={styles.doneButton}>Done</Text>
          </TouchableOpacity>
        )}
      </View>

      <KeyboardAvoidingScrollView
        ref={scrollViewRef}
        extraOffset={20}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Form fields */}
        <KeyboardAwareInput
          placeholder="Primary Diagnosis"
          value={formData.diagnosis}
          onChangeText={(text) => setFormData(prev => ({ ...prev, diagnosis: text }))}
          multiline
          numberOfLines={3}
        />
        
        <KeyboardAwareInput
          placeholder="Treatment Plan"
          value={formData.treatment}
          onChangeText={(text) => setFormData(prev => ({ ...prev, treatment: text }))}
          multiline
          numberOfLines={4}
        />
        
        <KeyboardAwareInput
          placeholder="Clinical Notes"
          value={formData.notes}
          onChangeText={(text) => setFormData(prev => ({ ...prev, notes: text }))}
          multiline
          numberOfLines={5}
        />
      </KeyboardAvoidingScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
          <Text style={styles.submitText}>Save Diagnosis</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
```

## Best Practices

### 1. Use Appropriate Components

- **Use `KeyboardAvoidingScrollView`** for forms with multiple inputs
- **Use `KeyboardAwareInput`** for individual inputs that need auto-scroll
- **Use `useKeyboardAvoidance`** for custom implementations

### 2. Set Proper Offsets

```tsx
// For forms with bottom buttons
<KeyboardAvoidingScrollView extraOffset={80}>
  {/* Content */}
</KeyboardAvoidingScrollView>

// For simple forms
<KeyboardAvoidingScrollView extraOffset={20}>
  {/* Content */}
</KeyboardAvoidingScrollView>
```

### 3. Handle Keyboard Dismissal

```tsx
const { dismissKeyboard } = useKeyboardAvoidance();

// Dismiss keyboard when form is submitted
const handleSubmit = () => {
  dismissKeyboard();
  // Handle submission
};

// Show "Done" button when keyboard is visible
{isKeyboardVisible && (
  <TouchableOpacity onPress={dismissKeyboard}>
    <Text>Done</Text>
  </TouchableOpacity>
)}
```

### 4. Optimize for Different Screen Sizes

```tsx
import { Dimensions } from 'react-native';

const { height } = Dimensions.get('window');
const isSmallScreen = height < 700;

<KeyboardAvoidingScrollView 
  extraOffset={isSmallScreen ? 40 : 20}
  contentContainerStyle={{ 
    paddingBottom: isSmallScreen ? 120 : 80 
  }}
>
  {/* Content */}
</KeyboardAvoidingScrollView>
```

## Troubleshooting

### Common Issues

1. **Input field still covered by keyboard**
   - Increase `extraOffset` value
   - Ensure `KeyboardAvoidingScrollView` is used instead of regular `ScrollView`
   - Check if `enableKeyboardAvoidingView` is set to `true`

2. **Animation is choppy**
   - Ensure `useNativeDriver` is set to `true`
   - Reduce `animationDuration` for faster animations

3. **Keyboard doesn't dismiss**
   - Use `dismissKeyboard()` function from the hook
   - Ensure `keyboardShouldPersistTaps="handled"` is set on ScrollView

### Platform-Specific Considerations

**iOS:**
- Uses `keyboardWillShow`/`keyboardWillHide` events for smoother animations
- Default behavior is `padding`
- May need `keyboardVerticalOffset` for navigation bars

**Android:**
- Uses `keyboardDidShow`/`keyboardDidHide` events
- Default behavior is `height`
- May need `windowSoftInputMode` adjustments in AndroidManifest.xml

## Migration Guide

### From Regular ScrollView

```tsx
// Before
<ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
  <TextInput placeholder="Enter text..." />
</ScrollView>

// After
<KeyboardAvoidingScrollView 
  extraOffset={20}
  contentContainerStyle={{ paddingBottom: 120 }}
>
  <KeyboardAwareInput placeholder="Enter text..." />
</KeyboardAvoidingScrollView>
```

### From KeyboardAvoidingView

```tsx
// Before
<KeyboardAvoidingView behavior="padding">
  <ScrollView>
    <TextInput placeholder="Enter text..." />
  </ScrollView>
</KeyboardAvoidingView>

// After
<KeyboardAvoidingScrollView extraOffset={20}>
  <KeyboardAwareInput placeholder="Enter text..." />
</KeyboardAvoidingScrollView>
```

## Performance Considerations

1. **Use native driver** for animations (default: `true`)
2. **Limit extraOffset** to necessary values only
3. **Avoid nested KeyboardAvoidingView** components
4. **Use `keyboardShouldPersistTaps="handled"`** for better UX

## Testing

Test the implementation on:
- Different screen sizes (iPhone SE, iPhone Pro Max, Android tablets)
- Different keyboard types (default, numeric, email)
- Both iOS and Android platforms
- Portrait and landscape orientations

The keyboard avoidance system is now implemented and ready to use throughout the UniHealth app!
