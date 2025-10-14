import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useSignature } from '@/contexts/SignatureContext';
import { useSignatureManager } from '@/hooks/ui/useSignatureManager';

// Test component to verify signature persistence
export function SignaturePersistenceTest() {
  const { currentSignature, isLoading } = useSignature();
  const { signature, hasSignature, clearSignature, loadLatestSignature } = useSignatureManager({
    showAlerts: false,
  });

  const [testResults, setTestResults] = useState<string[]>([]);

  const addTestResult = (result: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${result}`]);
  };

  const testSignaturePersistence = async () => {
    try {
      addTestResult('Starting signature persistence test...');
      
      // Test 1: Check if signature exists in context
      addTestResult(`Context signature: ${currentSignature ? 'Present' : 'Missing'}`);
      
      // Test 2: Check if signature exists in hook
      addTestResult(`Hook signature: ${signature ? 'Present' : 'Missing'}`);
      
      // Test 3: Check signature validity
      addTestResult(`Has valid signature: ${hasSignature ? 'Yes' : 'No'}`);
      
      // Test 4: Try to load latest signature
      const latest = await loadLatestSignature();
      addTestResult(`Latest signature loaded: ${latest ? 'Success' : 'Failed'}`);
      
      addTestResult('Signature persistence test completed!');
      
    } catch (error) {
      addTestResult(`Test error: ${error}`);
    }
  };

  const clearAllSignatures = async () => {
    try {
      await clearSignature();
      addTestResult('All signatures cleared');
    } catch (error) {
      addTestResult(`Clear error: ${error}`);
    }
  };

  useEffect(() => {
    if (!isLoading) {
      addTestResult('Signature context loaded');
    }
  }, [isLoading]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Signature Persistence Test</Text>
      
      <View style={styles.statusContainer}>
        <Text style={styles.statusText}>
          Context Loading: {isLoading ? 'Yes' : 'No'}
        </Text>
        <Text style={styles.statusText}>
          Has Signature: {hasSignature ? 'Yes' : 'No'}
        </Text>
        <Text style={styles.statusText}>
          Signature Length: {signature ? signature.length : 0}
        </Text>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.testButton} onPress={testSignaturePersistence}>
          <Text style={styles.buttonText}>Test Persistence</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.clearButton} onPress={clearAllSignatures}>
          <Text style={styles.buttonText}>Clear Signatures</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.resultsContainer}>
        <Text style={styles.resultsTitle}>Test Results:</Text>
        {testResults.map((result, index) => (
          <Text key={index} style={styles.resultText}>{result}</Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#FFFFFF',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  statusContainer: {
    backgroundColor: '#F3F4F6',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
  },
  statusText: {
    fontSize: 14,
    marginBottom: 5,
    color: '#374151',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  testButton: {
    backgroundColor: '#1E40AF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  clearButton: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  resultsContainer: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    padding: 15,
    borderRadius: 8,
  },
  resultsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#374151',
  },
  resultText: {
    fontSize: 12,
    marginBottom: 5,
    color: '#6B7280',
    fontFamily: 'monospace',
  },
});

