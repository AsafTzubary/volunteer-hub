const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 20;
const USERNAME_REGEX = /^[A-Za-z0-9]+$/;

const PASSWORD_MIN_LENGTH = 6;
const PASSWORD_MAX_LENGTH = 64;

function validateUsername(username) {
  if (username.length < USERNAME_MIN_LENGTH || username.length > USERNAME_MAX_LENGTH) {
    return `Username must be between ${USERNAME_MIN_LENGTH} and ${USERNAME_MAX_LENGTH} characters.`;
  }
  if (!USERNAME_REGEX.test(username)) {
    return 'Username can only contain English letters and numbers.';
  }
  return null;
}

function validatePassword(password) {
  if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
    return `Password must be between ${PASSWORD_MIN_LENGTH} and ${PASSWORD_MAX_LENGTH} characters.`;
  }
  return null;
}

module.exports = {
  USERNAME_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  USERNAME_REGEX,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  validateUsername,
  validatePassword,
};
