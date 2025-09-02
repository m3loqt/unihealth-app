/**
 * Validation hints for form fields
 * Provides helpful information about field requirements
 */

export interface ValidationHint {
  title: string;
  message: string;
  suggestion: string;
}

export const getFieldValidationHint = (fieldName: string, hasError?: boolean): ValidationHint => {
  const hints: Record<string, ValidationHint> = {
    email: hasError ? {
      title: 'Email',
      message: 'Email already exists',
      suggestion: 'Try a different email address',
    } : {
      title: 'Email',
      message: 'Valid email format required',
      suggestion: 'Use format: user@example.com',
    },
    firstName: {
      title: 'First Name',
      message: 'At least 2 characters',
      suggestion: 'Letters, spaces, hyphens only',
    },
    lastName: {
      title: 'Last Name',
      message: 'At least 2 characters',
      suggestion: 'Letters, spaces, hyphens only',
    },
    dateOfBirth: {
      title: 'Date of Birth',
      message: 'MM/DD/YYYY format',
      suggestion: 'Example: 12/25/1990',
    },
    gender: {
      title: 'Gender',
      message: 'Select from options',
      suggestion: 'Required for medical records',
    },
    address: {
      title: 'Address',
      message: 'At least 10 characters',
      suggestion: 'Include street, city, state',
    },
    contactNumber: {
      title: 'Contact Number',
      message: 'At least 10 digits',
      suggestion: 'Include country code if needed',
    },
    highestEducationalAttainment: {
      title: 'Education',
      message: 'Select from dropdown',
      suggestion: 'Required field',
    },
    bloodType: {
      title: 'Blood Type',
      message: 'Select from options',
      suggestion: 'Choose "Not known yet" if unsure',
    },
    allergies: {
      title: 'Allergies',
      message: 'Optional field',
      suggestion: 'Separate with commas if any',
    },
  };

  return hints[fieldName] || {
    title: 'Field',
    message: 'Check requirements',
    suggestion: 'Try again',
  };
};

export const getFieldMinLength = (fieldName: string): number => {
  const minLengths: Record<string, number> = {
    email: 5, // minimum for valid email
    firstName: 2,
    lastName: 2,
    dateOfBirth: 10, // MM/DD/YYYY format
    address: 10,
    contactNumber: 10,
    highestEducationalAttainment: 1, // just needs to be selected
    bloodType: 1, // just needs to be selected
    allergies: 0, // optional field
  };

  return minLengths[fieldName] || 1;
};

export const getFieldMaxLength = (fieldName: string): number => {
  const maxLengths: Record<string, number> = {
    email: 254,
    firstName: 50,
    lastName: 50,
    dateOfBirth: 10,
    address: 200,
    contactNumber: 20,
    highestEducationalAttainment: 50,
    bloodType: 20,
    allergies: 500,
  };

  return maxLengths[fieldName] || 100;
};
