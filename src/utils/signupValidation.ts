/**
 * Signup form validation utilities with user-friendly error messages
 */

export interface ValidationError {
  field: string;
  message: string;
  suggestion: string;
}

export interface SignupFormData {
  email: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  address: string;
  contactNumber: string;
  highestEducationalAttainment?: string;
  bloodType?: string;
  allergies?: string;
}

/**
 * Validate email format and provide helpful suggestions
 */
export const validateEmail = (email: string): ValidationError | null => {
  if (!email || email.trim().length === 0) {
    return {
      field: 'Email',
      message: 'Email address is required to create your account',
      suggestion: 'Please enter your email address (e.g., john.doe@example.com)'
    };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return {
      field: 'Email',
      message: 'Please enter a valid email address',
      suggestion: 'Make sure your email includes @ and a domain (e.g., .com, .org)'
    };
  }

  if (email.length > 254) {
    return {
      field: 'Email',
      message: 'Email address is too long',
      suggestion: 'Please use a shorter email address (maximum 254 characters)'
    };
  }

  return null;
};

/**
 * Check if email is already in use (Firebase validation)
 * This should be called after basic email validation passes
 */
export const checkEmailAvailability = async (email: string): Promise<ValidationError | null> => {
  try {
    // Import Firebase auth dynamically to avoid circular dependencies
    const { getAuth, fetchSignInMethodsForEmail } = await import('firebase/auth');
    const { auth } = await import('../config/firebase');
    
    // Check if email is already registered
    const methods = await fetchSignInMethodsForEmail(auth, email);
    
    if (methods.length > 0) {
      return {
        field: 'Email',
        message: 'This email is already registered',
        suggestion: 'Please use a different email address or sign in to your existing account'
      };
    }
    
    return null;
  } catch (error: any) {
    // If Firebase check fails, we'll let the server-side validation handle it
    console.warn('Email availability check failed:', error.message);
    return null;
  }
};

/**
 * Validate first name with helpful suggestions
 */
export const validateFirstName = (firstName: string): ValidationError | null => {
  if (!firstName || firstName.trim().length === 0) {
    return {
      field: 'First Name',
      message: 'First name is required',
      suggestion: 'Please enter your first name as it appears on your ID'
    };
  }

  if (firstName.trim().length < 2) {
    return {
      field: 'First Name',
      message: 'First name must be at least 2 characters long',
      suggestion: 'Please enter your complete first name'
    };
  }

  if (firstName.trim().length > 50) {
    return {
      field: 'First Name',
      message: 'First name is too long',
      suggestion: 'Please use a shorter version of your first name (maximum 50 characters)'
    };
  }

  const nameRegex = /^[a-zA-Z\s\-']+$/;
  if (!nameRegex.test(firstName)) {
    return {
      field: 'First Name',
      message: 'First name contains invalid characters',
      suggestion: 'Please use only letters, spaces, hyphens, and apostrophes'
    };
  }

  return null;
};

/**
 * Validate last name with helpful suggestions
 */
export const validateLastName = (lastName: string): ValidationError | null => {
  if (!lastName || lastName.trim().length === 0) {
    return {
      field: 'Last Name',
      message: 'Last name is required',
      suggestion: 'Please enter your last name as it appears on your ID'
    };
  }

  if (lastName.trim().length < 2) {
    return {
      field: 'Last Name',
      message: 'Last name must be at least 2 characters long',
      suggestion: 'Please enter your complete last name'
    };
  }

  if (lastName.trim().length > 50) {
    return {
      field: 'Last Name',
      message: 'Last name is too long',
      suggestion: 'Please use a shorter version of your last name (maximum 50 characters)'
    };
  }

  const nameRegex = /^[a-zA-Z\s\-']+$/;
  if (!nameRegex.test(lastName)) {
    return {
      field: 'Last Name',
      message: 'Last name contains invalid characters',
      suggestion: 'Please use only letters, spaces, hyphens, and apostrophes'
    };
  }

  return null;
};

/**
 * Validate date of birth with helpful suggestions
 */
export const validateDateOfBirth = (dateOfBirth: string): ValidationError | null => {
  if (!dateOfBirth || dateOfBirth.trim().length === 0) {
    return {
      field: 'Date of Birth',
      message: 'Date of birth is required',
      suggestion: 'Please enter your date of birth in MM/DD/YYYY format'
    };
  }

  // Check if format is MM/DD/YYYY
  const dateRegex = /^(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/\d{4}$/;
  if (!dateRegex.test(dateOfBirth)) {
    return {
      field: 'Date of Birth',
      message: 'Please use MM/DD/YYYY format',
      suggestion: 'Enter your date of birth as MM/DD/YYYY (e.g., 12/25/1990)'
    };
  }

  // Parse the date and validate
  const [month, day, year] = dateOfBirth.split('/').map(Number);
  const date = new Date(year, month - 1, day);
  
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return {
      field: 'Date of Birth',
      message: 'Please enter a valid date',
      suggestion: 'Make sure the month, day, and year are valid (e.g., not February 30th)'
    };
  }

  // Check if date is in the future
  const today = new Date();
  if (date > today) {
    return {
      field: 'Date of Birth',
      message: 'Date of birth cannot be in the future',
      suggestion: 'Please enter your actual date of birth'
    };
  }

  // Check if person is too old (reasonable limit: 150 years)
  const minDate = new Date();
  minDate.setFullYear(today.getFullYear() - 150);
  if (date < minDate) {
    return {
      field: 'Date of Birth',
      message: 'Date of birth seems incorrect',
      suggestion: 'Please check your date of birth. If correct, contact support'
    };
  }

  return null;
};

/**
 * Validate gender selection
 */
export const validateGender = (gender: string): ValidationError | null => {
  if (!gender || gender.trim().length === 0) {
    return {
      field: 'Gender',
      message: 'Please select your gender',
      suggestion: 'Tap on the gender field to choose from the available options'
    };
  }

  return null;
};

/**
 * Validate address with helpful suggestions
 */
export const validateAddress = (address: string): ValidationError | null => {
  if (!address || address.trim().length === 0) {
    return {
      field: 'Address',
      message: 'Address is required',
      suggestion: 'Please enter your complete residential address'
    };
  }

  if (address.trim().length < 10) {
    return {
      field: 'Address',
      message: 'Address is too short',
      suggestion: 'Please provide a complete address including street, city, and postal code'
    };
  }

  if (address.trim().length > 200) {
    return {
      field: 'Address',
      message: 'Address is too long',
      suggestion: 'Please provide a concise but complete address (maximum 200 characters)'
    };
  }

  return null;
};

/**
 * Validate contact number with helpful suggestions
 */
export const validateContactNumber = (contactNumber: string): ValidationError | null => {
  if (!contactNumber || contactNumber.trim().length === 0) {
    return {
      field: 'Contact Number',
      message: 'Contact number is required',
      suggestion: 'Please enter your phone number so we can contact you'
    };
  }

  // Remove all non-digit characters for validation
  const digitsOnly = contactNumber.replace(/\D/g, '');
  
  if (digitsOnly.length < 10) {
    return {
      field: 'Contact Number',
      message: 'Contact number is too short',
      suggestion: 'Please enter a complete phone number with area code (minimum 10 digits)'
    };
  }

  if (digitsOnly.length > 15) {
    return {
      field: 'Contact Number',
      message: 'Contact number is too long',
      suggestion: 'Please enter a valid phone number (maximum 15 digits)'
    };
  }

  return null;
};

/**
 * Validate highest educational attainment with helpful suggestions
 */
export const validateHighestEducationalAttainment = (highestEducationalAttainment: string): ValidationError | null => {
  if (!highestEducationalAttainment || highestEducationalAttainment.trim().length === 0) {
    return {
      field: 'Highest Educational Attainment',
      message: 'Highest educational attainment is required',
      suggestion: 'Please select your highest level of education from the available options'
    };
  }

  return null;
};

/**
 * Validate blood type with helpful suggestions
 */
export const validateBloodType = (bloodType: string): ValidationError | null => {
  if (!bloodType || bloodType.trim().length === 0) {
    return {
      field: 'Blood Type',
      message: 'Blood type is required for medical safety',
      suggestion: 'Please select your blood type from the available options. If unknown, select "Not known yet"'
    };
  }

  return null;
};

/**
 * Validate the entire signup form
 */
export const validateSignupForm = (formData: SignupFormData): ValidationError[] => {
  const errors: ValidationError[] = [];

  // Validate required fields
  const emailError = validateEmail(formData.email);
  if (emailError) errors.push(emailError);

  const firstNameError = validateFirstName(formData.firstName);
  if (firstNameError) errors.push(firstNameError);

  const lastNameError = validateLastName(formData.lastName);
  if (lastNameError) errors.push(lastNameError);

  const dateOfBirthError = validateDateOfBirth(formData.dateOfBirth);
  if (dateOfBirthError) errors.push(dateOfBirthError);

  const genderError = validateGender(formData.gender);
  if (genderError) errors.push(genderError);

  const addressError = validateAddress(formData.address);
  if (addressError) errors.push(addressError);

  const contactNumberError = validateContactNumber(formData.contactNumber);
  if (contactNumberError) errors.push(contactNumberError);

  const highestEducationalAttainmentError = validateHighestEducationalAttainment(formData.highestEducationalAttainment);
  if (highestEducationalAttainmentError) errors.push(highestEducationalAttainmentError);

  const bloodTypeError = validateBloodType(formData.bloodType);
  if (bloodTypeError) errors.push(bloodTypeError);

  return errors;
};

/**
 * Get the first validation error for a specific field
 */
export const getFieldError = (fieldName: string, formData: SignupFormData): ValidationError | null => {
  switch (fieldName) {
    case 'email':
      return validateEmail(formData.email);
    case 'firstName':
      return validateFirstName(formData.firstName);
    case 'lastName':
      return validateLastName(formData.lastName);
    case 'dateOfBirth':
      return validateDateOfBirth(formData.dateOfBirth);
    case 'gender':
      return validateGender(formData.gender);
    case 'address':
      return validateAddress(formData.address);
    case 'contactNumber':
      return validateContactNumber(formData.contactNumber);
    case 'highestEducationalAttainment':
      return validateHighestEducationalAttainment(formData.highestEducationalAttainment);
    case 'bloodType':
      return validateBloodType(formData.bloodType);
    default:
      return null;
  }
};

/**
 * Check if a specific field has validation errors
 */
export const hasFieldError = (fieldName: string, formData: SignupFormData): boolean => {
  return getFieldError(fieldName, formData) !== null;
};

/**
 * Get all validation errors for the form
 */
export const getAllErrors = (formData: SignupFormData): ValidationError[] => {
  return validateSignupForm(formData);
};
