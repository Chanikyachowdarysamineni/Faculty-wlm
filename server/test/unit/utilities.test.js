const jwt = require('jsonwebtoken');
const bcryptjs = require('bcryptjs');

const JWT_SECRET = 'test-secret-key-12345';

describe('JWT Utilities', () => {
  describe('Token Generation', () => {
    test('should generate a valid JWT token with correct payload', () => {
      const payload = { userId: '123', role: 'admin' };
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      
      const decoded = jwt.verify(token, JWT_SECRET);
      expect(decoded.userId).toBe('123');
      expect(decoded.role).toBe('admin');
    });

    test('should include expiration time in token', () => {
      const payload = { userId: '123' };
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });
      const decoded = jwt.decode(token);
      
      expect(decoded.exp).toBeDefined();
      expect(decoded.iat).toBeDefined();
    });

    test('should reject expired token', () => {
      const payload = { userId: '123' };
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '0s' });
      
      expect(() => {
        jwt.verify(token, JWT_SECRET);
      }).toThrow();
    });
  });

  describe('Token Verification', () => {
    test('should verify valid token', () => {
      const payload = { userId: '123', role: 'faculty' };
      const token = jwt.sign(payload, JWT_SECRET);
      
      const verified = jwt.verify(token, JWT_SECRET);
      expect(verified.userId).toBe('123');
      expect(verified.role).toBe('faculty');
    });

    test('should reject token with wrong secret', () => {
      const payload = { userId: '123' };
      const token = jwt.sign(payload, JWT_SECRET);
      
      expect(() => {
        jwt.verify(token, 'wrong-secret');
      }).toThrow();
    });

    test('should reject malformed token', () => {
      const malformedToken = 'invalid.token.here';
      
      expect(() => {
        jwt.verify(malformedToken, JWT_SECRET);
      }).toThrow();
    });
  });
});

describe('Password Hashing', () => {
  describe('Password Hashing', () => {
    test('should hash password successfully', async () => {
      const password = 'secure-password-123';
      const hash = await bcryptjs.hash(password, 10);
      
      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(0);
    });

    test('should generate different hashes for same password', async () => {
      const password = 'secure-password-123';
      const hash1 = await bcryptjs.hash(password, 10);
      const hash2 = await bcryptjs.hash(password, 10);
      
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('Password Comparison', () => {
    test('should verify correct password', async () => {
      const password = 'secure-password-123';
      const hash = await bcryptjs.hash(password, 10);
      
      const isMatch = await bcryptjs.compare(password, hash);
      expect(isMatch).toBe(true);
    });

    test('should reject incorrect password', async () => {
      const password = 'secure-password-123';
      const wrongPassword = 'wrong-password-456';
      const hash = await bcryptjs.hash(password, 10);
      
      const isMatch = await bcryptjs.compare(wrongPassword, hash);
      expect(isMatch).toBe(false);
    });
  });
});

describe('Data Validation', () => {
  describe('Email Validation', () => {
    test('should validate correct email format', () => {
      const validEmails = [
        'user@example.com',
        'test.user@domain.co.uk',
        'name+tag@company.org'
      ];
      
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      validEmails.forEach(email => {
        expect(emailRegex.test(email)).toBe(true);
      });
    });

    test('should reject invalid email format', () => {
      const invalidEmails = [
        'invalid.email',
        '@nodomain.com',
        'user@.com',
        'user name@example.com'
      ];
      
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      invalidEmails.forEach(email => {
        expect(emailRegex.test(email)).toBe(false);
      });
    });
  });

  describe('Employee ID Validation', () => {
    test('should validate correct employee ID format', () => {
      const validIds = ['admin', 'faculty001', 'faculty002', 'EMP12345'];
      const idRegex = /^[a-zA-Z0-9]{3,}$/;
      
      validIds.forEach(id => {
        expect(idRegex.test(id)).toBe(true);
      });
    });

    test('should reject invalid employee ID format', () => {
      const invalidIds = ['', 'a', 'ab', 'emp@123', 'emp-123'];
      const idRegex = /^[a-zA-Z0-9]{3,}$/;
      
      invalidIds.forEach(id => {
        expect(idRegex.test(id)).toBe(false);
      });
    });
  });
});
