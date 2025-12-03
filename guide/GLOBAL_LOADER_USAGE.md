# GlobalLoader Usage Guide

## Overview
The GlobalLoader is a beautiful, animated hourglass loading component that can be used throughout your UniHealth app for any loading states. It features:

- 🕐 **Animated Hourglass**: Slowly fills with sand while rotating
- ✨ **Shimmer Effect**: Subtle light reflection animation
-  **Progress Bar**: Optional progress tracking (0-100%)
- 🎨 **Brand Consistent**: Uses UniHealth colors and typography
- 🔄 **Message Updates**: Dynamic loading messages
- 📱 **Responsive**: Works on all screen sizes

## Basic Usage

### 1. Import the Component and Hook
```tsx
import { GlobalLoader } from '../src/components/ui';
import { useGlobalLoader } from '../src/hooks/ui';
```

### 2. Use the Hook in Your Component
```tsx
export default function MyScreen() {
  const loader = useGlobalLoader();
  
  // Your component logic here
  
  return (
    <View>
      {/* Your content */}
      
      {/* The GlobalLoader component */}
      <GlobalLoader
        visible={loader.visible}
        message={loader.message}
        showProgress={loader.showProgress}
        progress={loader.progress}
      />
    </View>
  );
}
```

## Available Methods

### Simple Loading
```tsx
// Show loader with default message
loader.show();

// Show loader with custom message
loader.show('Processing your request...');

// Hide loader
loader.hide();
```

### Loading with Progress
```tsx
// Show loader with progress bar
loader.showWithProgress('Uploading files...');

// Update progress (0.0 to 1.0)
loader.updateProgress(0.5); // 50%

// Hide when complete
loader.hide();
```

### Dynamic Messages
```tsx
// Show initial message
loader.show('Initializing...');

// Update message during process
loader.updateMessage('Connecting to server...');
loader.updateMessage('Authenticating...');
loader.updateMessage('Loading data...');

// Hide when complete
loader.hide();
```

## Real-World Examples

### API Call Loading
```tsx
const handleSubmit = async () => {
  loader.show('Submitting form...');
  
  try {
    const result = await api.submitForm(formData);
    // Handle success
  } catch (error) {
    // Handle error
  } finally {
    loader.hide();
  }
};
```

### File Upload with Progress
```tsx
const handleFileUpload = async (file) => {
  loader.showWithProgress('Uploading file...');
  
  try {
    const uploadTask = await uploadFile(file);
    
    uploadTask.on('state_changed', (snapshot) => {
      const progress = snapshot.bytesTransferred / snapshot.totalBytes;
      loader.updateProgress(progress);
    });
    
    await uploadTask;
    loader.hide();
  } catch (error) {
    loader.hide();
    // Handle error
  }
};
```

### Multi-Step Process
```tsx
const handleMultiStepProcess = async () => {
  loader.show('Starting process...');
  
  try {
    // Step 1
    loader.updateMessage('Initializing system...');
    await step1();
    
    // Step 2
    loader.updateMessage('Processing data...');
    await step2();
    
    // Step 3
    loader.updateMessage('Finalizing...');
    await step3();
    
    loader.hide();
  } catch (error) {
    loader.hide();
    // Handle error
  }
};
```

## Replacing Existing Loading States

### Before (Old Loading Modal)
```tsx
const [isLoading, setIsLoading] = useState(false);

// In your JSX
<Modal visible={isLoading} transparent>
  <View style={styles.loadingOverlay}>
    <Text>Loading...</Text>
  </View>
</Modal>

// In your functions
const handleAction = async () => {
  setIsLoading(true);
  try {
    await someAsyncAction();
  } finally {
    setIsLoading(false);
  }
};
```

### After (New GlobalLoader)
```tsx
import { useGlobalLoader } from '../src/hooks/ui';

export default function MyScreen() {
  const loader = useGlobalLoader();
  
  const handleAction = async () => {
    loader.show('Processing...');
    try {
      await someAsyncAction();
    } finally {
      loader.hide();
    }
  };
  
  return (
    <View>
      {/* Your content */}
      <GlobalLoader
        visible={loader.visible}
        message={loader.message}
        showProgress={loader.showProgress}
        progress={loader.progress}
      />
    </View>
  );
}
```

## Customization

The GlobalLoader automatically uses your UniHealth brand colors:
- Primary: `#1E40AF` (Blue)
- Secondary: `#3B82F6` (Lighter Blue)
- Accent: `#60A5FA` (Light Blue)

## Best Practices

1. **Always hide the loader** in finally blocks or error handlers
2. **Use descriptive messages** that tell users what's happening
3. **Show progress** for long-running operations (uploads, downloads)
4. **Update messages** for multi-step processes
5. **Keep messages concise** but informative

## Performance Notes

- The GlobalLoader uses React Native Reanimated for smooth 60fps animations
- All animations are optimized and won't impact app performance
- The component automatically cleans up animations when hidden

## Troubleshooting

### Loader not showing?
- Check that `visible` prop is true
- Ensure the component is rendered in your JSX
- Verify the hook is properly imported

### Animations not working?
- Make sure `react-native-reanimated` is properly installed
- Check that the component is mounted in the component tree

### Progress bar not updating?
- Use `showWithProgress()` instead of `show()`
- Ensure progress values are between 0 and 1
- Check that `showProgress` prop is true
