/**
 * Test file for signup validation utilities
 * This demonstrates how the validation functions work
 */

import {
  validateEmail,
  validateFirstName,
  validateLastName,
  validateDateOfBirth,
  validateGender,
  validateAddress,
  validateContactNumber,
  validateHighestEducationalAttainment,
  validateBloodType,
  validateSignupForm,
  type SignupFormData
} from '../signupValidation';

describe('Signup Validation Tests', () => {
  describe('Email Validation', () => {
    it('should validate correct email formats', () => {
      expect(validateEmail('test@example.com')).toBeNull();
      expect(validateEmail('user.name@domain.co.uk')).toBeNull();
      expect(validateEmail('test+tag@example.org')).toBeNull();
    });

    it('should reject invalid email formats', () => {
      const invalidEmail = validateEmail('invalid-email');
      expect(invalidEmail).not.toBeNull();
      expect(invalidEmail?.message).toContain('valid email address');
      expect(invalidEmail?.suggestion).toContain('@ and a domain');
    });

    it('should require email field', () => {
      const emptyEmail = validateEmail('');
      expect(emptyEmail).not.toBeNull();
      expect(emptyEmail?.message).toContain('required');
    });
  });

  describe('First Name Validation', () => {
    it('should validate correct first names', () => {
      expect(validateFirstName('John')).toBeNull();
      expect(validateFirstName('Mary-Jane')).toBeNull();
      expect(validateFirstName('O\'Connor')).toBeNull();
    });

    it('should reject names that are too short', () => {
      const shortName = validateFirstName('A');
      expect(shortName).not.toBeNull();
      expect(shortName?.message).toContain('at least 2 characters');
    });

    it('should reject names with invalid characters', () => {
      const invalidName = validateFirstName('John123');
      expect(invalidName).not.toBeNull();
      expect(invalidName?.message).toContain('invalid characters');
    });
  });

  describe('Date of Birth Validation', () => {
    it('should validate correct date formats', () => {
      expect(validateDateOfBirth('12/25/1990')).toBeNull();
      expect(validateDateOfBirth('01/01/2000')).toBeNull();
    });

    it('should reject invalid date formats', () => {
      const invalidFormat = validateDateOfBirth('1990-12-25');
      expect(invalidFormat).not.toBeNull();
      expect(invalidFormat?.message).toContain('MM/DD/YYYY format');
    });

    it('should reject future dates', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      const futureDateStr = `${(futureDate.getMonth() + 1).toString().padStart(2, '0')}/${futureDate.getDate().toString().padStart(2, '0')}/${futureDate.getFullYear()}`;
      
      const invalidDate = validateDateOfBirth(futureDateStr);
      expect(invalidDate).not.toBeNull();
      expect(invalidDate?.message).toContain('cannot be in the future');
    });
  });

  describe('Highest Educational Attainment Validation', () => {
    it('should validate selected educational attainment', () => {
      expect(validateHighestEducationalAttainment('Bachelor\'s Degree')).toBeNull();
      expect(validateHighestEducationalAttainment('High School')).toBeNull();
    });

    it('should require educational attainment selection', () => {
      const emptySelection = validateHighestEducationalAttainment('');
      expect(emptySelection).not.toBeNull();
      expect(emptySelection?.message).toContain('required');
    });
  });

  describe('Blood Type Validation', () => {
    it('should validate selected blood type', () => {
      expect(validateBloodType('O+')).toBeNull();
      expect(validateBloodType('AB-')).toBeNull();
      expect(validateBloodType('Not known yet')).toBeNull();
    });

    it('should require blood type selection', () => {
      const emptySelection = validateBloodType('');
      expect(emptySelection).not.toBeNull();
      expect(emptySelection?.message).toContain('required');
    });
  });

  describe('Complete Form Validation', () => {
    it('should validate a complete valid form', () => {
      const validForm: SignupFormData = {
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: '12/25/1990',
        gender: 'Male',
        address: '123 Main Street, City, State 12345',
        contactNumber: '555-123-4567',
        middleName: '',
        highestEducationalAttainment: 'Bachelor\'s Degree',
        bloodType: 'O+',
        allergies: ''
      };

      const errors = validateSignupForm(validForm);
      expect(errors).toHaveLength(0);
    });

    it('should return errors for incomplete form', () => {
      const incompleteForm: SignupFormData = {
        email: '',
        firstName: '',
        lastName: '',
        dateOfBirth: '',
        gender: '',
        address: '',
        contactNumber: '',
        middleName: '',
        highestEducationalAttainment: '',
        bloodType: '',
        allergies: ''
      };

      const errors = validateSignupForm(incompleteForm);
      expect(errors.length).toBeGreaterThan(0);
      
      // Check that we get errors for all required fields
      const errorFields = errors.map(error => error.field);
      expect(errorFields).toContain('Email');
      expect(errorFields).toContain('First Name');
      expect(errorFields).toContain('Last Name');
      expect(errorFields).toContain('Date of Birth');
      expect(errorFields).toContain('Gender');
      expect(errorFields).toContain('Address');
      expect(errorFields).toContain('Contact Number');
      expect(errorFields).toContain('Highest Educational Attainment');
      expect(errorFields).toContain('Blood Type');
    });

    it('should provide actionable suggestions for each error', () => {
      const incompleteForm: SignupFormData = {
        email: 'invalid-email',
        firstName: 'A',
        lastName: '',
        dateOfBirth: 'invalid-date',
        gender: '',
        address: 'Short',
        contactNumber: '123',
        middleName: '',
        highestEducationalAttainment: '',
        bloodType: '',
        allergies: ''
      };

      const errors = validateSignupForm(incompleteForm);
      
      errors.forEach(error => {
        expect(error.suggestion).toBeTruthy();
        expect(error.suggestion.length).toBeGreaterThan(0);
        expect(error.field).toBeTruthy();
        expect(error.message).toBeTruthy();
      });
    });
  });
});

// Example usage demonstration
console.log('=== Signup Validation Examples ===');

const sampleForm: SignupFormData = {
  email: 'user@example.com',
  firstName: 'John',
  lastName: 'Doe',
  dateOfBirth: '12/25/1990',
  gender: 'Male',
  address: '123 Main Street, City, State 12345',
  contactNumber: '555-123-4567',
  middleName: '',
  highestEducationalAttainment: 'Bachelor\'s Degree',
  bloodType: 'O+',
  allergies: ''
};

console.log('Validating sample form...');
const validationErrors = validateSignupForm(sampleForm);

if (validationErrors.length === 0) {
  console.log('✅ Form is valid!');
} else {
  console.log('❌ Form has validation errors:');
  validationErrors.forEach((error, index) => {
    console.log(`${index + 1}. ${error.field}: ${error.message}`);
    console.log(`   💡 ${error.suggestion}`);
  });
}
