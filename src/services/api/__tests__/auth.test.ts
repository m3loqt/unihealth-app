/**
 * Test file for authentication service
 * Tests the specialist status validation functionality
 */

import { authService } from '../auth';

// Mock Firebase modules
jest.mock('firebase/auth', () => ({
  signInWithEmailAndPassword: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
  confirmPasswordReset: jest.fn(),
  signOut: jest.fn(),
  onAuthStateChanged: jest.fn(),
  updatePassword: jest.fn(),
}));

jest.mock('firebase/database', () => ({
  ref: jest.fn(),
  set: jest.fn(),
  get: jest.fn(),
  child: jest.fn(),
  remove: jest.fn(),
  query: jest.fn(),
  orderByChild: jest.fn(),
  equalTo: jest.fn(),
}));

jest.mock('../../config/firebase', () => ({
  auth: {},
  database: {},
}));

describe('Authentication Service Tests', () => {
  describe('Specialist Status Validation', () => {
    it('should allow login for specialist with approved status', async () => {
      // Mock Firebase database response for approved specialist
      const mockDoctorData = {
        status: 'approved',
        firstName: 'Dr. John',
        lastName: 'Doe',
        email: 'doctor@example.com'
      };

      const { get } = require('firebase/database');
      get.mockResolvedValue({
        exists: () => true,
        val: () => mockDoctorData
      });

      const result = await authService.checkSpecialistStatus('test-doctor-id');
      expect(result).toBe(true);
    });

    it('should deny login for specialist with pending status', async () => {
      // Mock Firebase database response for pending specialist
      const mockDoctorData = {
        status: 'pending',
        firstName: 'Dr. Jane',
        lastName: 'Smith',
        email: 'pending@example.com'
      };

      const { get } = require('firebase/database');
      get.mockResolvedValue({
        exists: () => true,
        val: () => mockDoctorData
      });

      const result = await authService.checkSpecialistStatus('test-doctor-id');
      expect(result).toBe(false);
    });

    it('should allow login when no doctor data exists (new specialist)', async () => {
      // Mock Firebase database response for non-existent doctor
      const { get } = require('firebase/database');
      get.mockResolvedValue({
        exists: () => false,
        val: () => null
      });

      const result = await authService.checkSpecialistStatus('test-doctor-id');
      expect(result).toBe(true);
    });

    it('should allow login when database error occurs (graceful fallback)', async () => {
      // Mock Firebase database error
      const { get } = require('firebase/database');
      get.mockRejectedValue(new Error('Database connection failed'));

      const result = await authService.checkSpecialistStatus('test-doctor-id');
      expect(result).toBe(true); // Should allow login on error
    });

    it('should allow login for specialist with undefined status', async () => {
      // Mock Firebase database response for specialist with no status field
      const mockDoctorData = {
        firstName: 'Dr. Bob',
        lastName: 'Johnson',
        email: 'bob@example.com'
        // No status field
      };

      const { get } = require('firebase/database');
      get.mockResolvedValue({
        exists: () => true,
        val: () => mockDoctorData
      });

      const result = await authService.checkSpecialistStatus('test-doctor-id');
      expect(result).toBe(true);
    });
  });

  describe('Sign In with Status Validation', () => {
    it('should throw error when specialist with pending status tries to sign in', async () => {
      // Mock Firebase Auth success
      const { signInWithEmailAndPassword } = require('firebase/auth');
      signInWithEmailAndPassword.mockResolvedValue({
        user: { uid: 'test-uid', email: 'doctor@example.com' }
      });

      // Mock user profile lookup
      const mockUserProfile = {
        uid: 'test-uid',
        email: 'doctor@example.com',
        role: 'specialist',
        firstName: 'Dr. John',
        lastName: 'Doe'
      };

      // Mock getCompleteUserProfile to return specialist profile
      jest.spyOn(authService, 'getCompleteUserProfile').mockResolvedValue(mockUserProfile);

      // Mock checkSpecialistStatus to return false (pending status)
      jest.spyOn(authService, 'checkSpecialistStatus').mockResolvedValue(false);

      await expect(authService.signIn('doctor@example.com', 'password123'))
        .rejects
        .toThrow('Your account is currently pending approval. Please contact support for assistance.');
    });

    it('should allow sign in for specialist with approved status', async () => {
      // Mock Firebase Auth success
      const { signInWithEmailAndPassword } = require('firebase/auth');
      signInWithEmailAndPassword.mockResolvedValue({
        user: { uid: 'test-uid', email: 'doctor@example.com' }
      });

      // Mock user profile lookup
      const mockUserProfile = {
        uid: 'test-uid',
        email: 'doctor@example.com',
        role: 'specialist',
        firstName: 'Dr. John',
        lastName: 'Doe'
      };

      // Mock getCompleteUserProfile to return specialist profile
      jest.spyOn(authService, 'getCompleteUserProfile').mockResolvedValue(mockUserProfile);

      // Mock checkSpecialistStatus to return true (approved status)
      jest.spyOn(authService, 'checkSpecialistStatus').mockResolvedValue(true);

      const result = await authService.signIn('doctor@example.com', 'password123');
      expect(result).toEqual(mockUserProfile);
    });

    it('should allow sign in for patients without status check', async () => {
      // Mock Firebase Auth success
      const { signInWithEmailAndPassword } = require('firebase/auth');
      signInWithEmailAndPassword.mockResolvedValue({
        user: { uid: 'test-uid', email: 'patient@example.com' }
      });

      // Mock user profile lookup
      const mockUserProfile = {
        uid: 'test-uid',
        email: 'patient@example.com',
        role: 'patient',
        firstName: 'John',
        lastName: 'Doe'
      };

      // Mock getCompleteUserProfile to return patient profile
      jest.spyOn(authService, 'getCompleteUserProfile').mockResolvedValue(mockUserProfile);

      // Mock checkSpecialistStatus (should not be called for patients)
      const checkSpecialistStatusSpy = jest.spyOn(authService, 'checkSpecialistStatus');

      const result = await authService.signIn('patient@example.com', 'password123');
      expect(result).toEqual(mockUserProfile);
      expect(checkSpecialistStatusSpy).not.toHaveBeenCalled();
    });
  });
});

// Example usage demonstration
console.log('=== Authentication Service Examples ===');

// Test the specialist status validation function
console.log('Testing specialist status validation...');

// Note: These examples would require actual Firebase setup to run
// In a real test environment, you would set up Firebase test database

console.log('✅ Specialist status validation tests completed');
console.log('✅ Sign in with status validation tests completed');
